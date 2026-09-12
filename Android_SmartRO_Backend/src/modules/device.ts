// ESP32 hardware integration.
// These endpoints are NOT JWT-protected; they validate a per-device token
// stored on the Device row. The hardware polls /state to decide whether to
// open or close its solenoid valve, and posts /heartbeat to declare itself
// alive + report firmware/wifi.

import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { prisma } from '../core/prisma';
import { authRequired } from '../core/auth';
import { asyncHandler, BadRequest, Conflict, NotFound, Unauthorized } from '../core/errors';
import { validateBody } from '../core/validate';

const router = Router();

// Grace days: device keeps flowing for N days after subscription expires.
const GRACE_DAYS = Number(process.env.DEVICE_GRACE_DAYS ?? 0);

async function authorizeDevice(serial: string, token: string | undefined) {
  if (!token) throw Unauthorized('Missing device token');
  const device = await prisma.device.findUnique({
    where: { serial },
    include: { subscription: { include: { user: true } } },
  });
  if (!device) throw NotFound('Device not found');
  if (!device.deviceToken || device.deviceToken !== token) throw Unauthorized('Invalid device token');
  return device;
}

// ESP32 polls this to decide flow on/off.
router.get(
  '/:serial/state',
  asyncHandler(async (req, res) => {
    const token = (req.query.token as string | undefined) ?? req.header('x-device-token') ?? undefined;
    const device = await authorizeDevice(req.params.serial, token);
    const sub = device.subscription;

    let allowFlow = false;
    let status = 'NO_SUBSCRIPTION';
    let expiresAt: string | null = null;
    let message: string | null = null;

    if (sub) {
      status = sub.status;
      expiresAt = sub.expiresAt.toISOString();
      const now = Date.now();
      const expiry = new Date(sub.expiresAt).getTime();
      const graceEnd = expiry + GRACE_DAYS * 86400000;
      if (sub.status === 'ACTIVE' && now <= graceEnd) {
        allowFlow = true;
      } else if (sub.status === 'GRACE') {
        allowFlow = now <= graceEnd;
        if (!allowFlow) message = 'Subscription in grace expired';
      } else {
        message = `Subscription ${sub.status}`;
      }
    } else {
      message = 'No active subscription';
    }

    // Polling hint: fast when there's anything live to react to (recharge
    // extension, pause/resume, mandate debit). Slow when there's no
    // subscription at all — saves the device's batt/data and the server load.
    const pollIntervalSec = !sub
      ? 3600
      : sub.status === 'ACTIVE' || sub.status === 'GRACE'
        ? 60
        : sub.status === 'PAUSED'
          ? 300
          : 1800;

    res.json({
      data: {
        allowFlow,
        status,
        expiresAt,
        graceDays: GRACE_DAYS,
        pollIntervalSec,
        message,
        serverTime: new Date().toISOString(),
      },
    });
  })
);

const heartbeatSchema = z.object({
  firmwareVersion: z.string().max(40).optional(),
  wifiSsid: z.string().max(80).optional(),
  // Live telemetry — all optional so legacy firmware that only sends presence
  // continues to work without payload changes.
  tdsPpm: z.number().int().min(0).max(5000).optional(),
  filterLifePct: z.number().int().min(0).max(100).optional(),
  usageLitresDelta: z.number().int().min(0).max(10000).optional(),
  leak: z.boolean().optional(),
  temperatureC: z.number().min(-20).max(120).optional(),
});

router.post(
  '/:serial/heartbeat',
  validateBody(heartbeatSchema),
  asyncHandler(async (req, res) => {
    const token = (req.query.token as string | undefined) ?? req.header('x-device-token') ?? undefined;
    const device = await authorizeDevice(req.params.serial, token);
    const body = req.body as z.infer<typeof heartbeatSchema>;

    const updated = await prisma.$transaction(async (tx) => {
      const dev = await tx.device.update({
        where: { id: device.id },
        data: {
          lastHeartbeatAt: new Date(),
          firmwareVersion: body.firmwareVersion ?? device.firmwareVersion,
          wifiSsid: body.wifiSsid ?? device.wifiSsid,
          lastTdsPpm: body.tdsPpm ?? device.lastTdsPpm,
          filterLifePct: body.filterLifePct ?? device.filterLifePct,
          usageLitresTotal: body.usageLitresDelta
            ? device.usageLitresTotal + body.usageLitresDelta
            : device.usageLitresTotal,
          leakDetectedAt: body.leak ? new Date() : device.leakDetectedAt,
        },
        select: {
          id: true, lastHeartbeatAt: true, firmwareVersion: true, wifiSsid: true,
          lastTdsPpm: true, filterLifePct: true, usageLitresTotal: true, leakDetectedAt: true,
        },
      });

      // Append-only readings for charting + filter-life trend
      const inserts: { kind: string; tdsPpm?: number; usageLitres?: number; filterLifePct?: number }[] = [];
      if (typeof body.tdsPpm === 'number') inserts.push({ kind: 'TDS', tdsPpm: body.tdsPpm });
      if (typeof body.usageLitresDelta === 'number' && body.usageLitresDelta > 0)
        inserts.push({ kind: 'USAGE', usageLitres: body.usageLitresDelta });
      if (typeof body.filterLifePct === 'number') inserts.push({ kind: 'FILTER_LIFE', filterLifePct: body.filterLifePct });
      if (body.leak) inserts.push({ kind: 'LEAK' });
      for (const r of inserts) {
        await tx.deviceReading.create({ data: { deviceId: device.id, ...r } });
      }
      return dev;
    });

    // Leak-detected → create HIGH-priority repair ticket + notify, but only if
    // the device has an attached subscription/user.
    if (body.leak && device.subscription) {
      await prisma.ticket.create({
        data: {
          userId: device.subscription.userId,
          subscriptionId: device.subscription.id,
          deviceId: device.id,
          category: 'REPAIR',
          description: 'Leak detected by device sensor',
          status: 'OPEN',
          priority: 'HIGH',
          slaDueAt: new Date(Date.now() + 12 * 3600 * 1000),
        },
      });
      await prisma.notification.create({
        data: {
          userId: device.subscription.userId,
          channel: 'INAPP',
          title: 'Leak detected',
          body: 'Your purifier reported a leak. A technician will be dispatched shortly.',
        },
      });
    }

    // Filter-life threshold → schedule a filter visit when crossing 15%
    if (typeof body.filterLifePct === 'number' && body.filterLifePct <= 15 && device.subscription) {
      const existing = await prisma.ticket.findFirst({
        where: {
          deviceId: device.id,
          category: 'FILTER',
          status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
        },
      });
      if (!existing) {
        await prisma.ticket.create({
          data: {
            userId: device.subscription.userId,
            subscriptionId: device.subscription.id,
            deviceId: device.id,
            category: 'FILTER',
            description: `Filter at ${body.filterLifePct}% — replacement due`,
            status: 'OPEN',
            priority: 'MEDIUM',
            slaDueAt: new Date(Date.now() + 72 * 3600 * 1000),
          },
        });
      }
    }

    res.json({ data: updated });
  })
);

// ─────────────────────────── Push token register ───────────────────────────
//
// Mobile app calls this on app start (and on app foreground) with the
// Expo / FCM token issued by the OS. Tokens are unique-by-value so re-posting
// the same token is a no-op.

const pushTokenSchema = z.object({
  token: z.string().min(40).max(4096),
  platform: z.enum(['EXPO', 'FCM', 'APNS']).default('EXPO'),
  deviceLabel: z.string().max(120).optional(),
});

router.post(
  '/me/push-token',
  authRequired(['CUSTOMER']),
  validateBody(pushTokenSchema),
  asyncHandler(async (req, res) => {
    const { token, platform, deviceLabel } = req.body as z.infer<typeof pushTokenSchema>;
    const existing = await prisma.pushToken.findUnique({ where: { token } });
    if (existing && existing.userId !== req.auth!.sub) {
      // Token reassigned to a new user (uninstall + reinstall + new login).
      await prisma.pushToken.update({
        where: { id: existing.id },
        data: { userId: req.auth!.sub, platform, deviceLabel, lastSeenAt: new Date() },
      });
    } else if (existing) {
      await prisma.pushToken.update({
        where: { id: existing.id },
        data: { platform, deviceLabel, lastSeenAt: new Date() },
      });
    } else {
      await prisma.pushToken.create({
        data: { userId: req.auth!.sub, token, platform, deviceLabel },
      });
    }
    res.json({ data: { ok: true } });
  })
);

router.delete(
  '/me/push-token',
  authRequired(['CUSTOMER']),
  validateBody(z.object({ token: z.string().min(40) })),
  asyncHandler(async (req, res) => {
    await prisma.pushToken.deleteMany({
      where: { userId: req.auth!.sub, token: req.body.token },
    });
    res.json({ data: { ok: true } });
  })
);

// ─────────────────────────── Customer-facing device health ───────────────────────────

router.get(
  '/me/health',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const sub = await prisma.subscription.findFirst({
      where: { userId: req.auth!.sub, status: { in: ['ACTIVE', 'GRACE', 'PAUSED'] } },
      include: { device: true, plan: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub || !sub.device) {
      return res.json({ data: null });
    }
    const dev = sub.device;
    const isOnline = dev.lastHeartbeatAt
      ? Date.now() - dev.lastHeartbeatAt.getTime() < 90 * 60 * 1000
      : false;
    res.json({
      data: {
        serial: dev.serial,
        isOnline,
        lastHeartbeatAt: dev.lastHeartbeatAt,
        tdsPpm: dev.lastTdsPpm,
        filterLifePct: dev.filterLifePct,
        usageLitresTotal: dev.usageLitresTotal,
        leakDetectedAt: dev.leakDetectedAt,
        subscriptionStatus: sub.status,
        expiresAt: sub.expiresAt,
        planName: sub.plan.name,
      },
    });
  })
);

router.get(
  '/me/readings',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const kind = (req.query.kind as string | undefined) ?? undefined;
    const limit = Math.min(Number(req.query.limit ?? 50), 200);

    const sub = await prisma.subscription.findFirst({
      where: { userId: req.auth!.sub },
      include: { device: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub?.deviceId) return res.json({ data: [] });

    const items = await prisma.deviceReading.findMany({
      where: { deviceId: sub.deviceId, ...(kind ? { kind } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json({ data: items });
  })
);

// ───────────────────────────────────── Device ↔ Subscription pairing ───────────────────────
//
// Allocation is the atomic step that turns a warehouse Device into a unit
// running at a customer's home. After allocate():
//   • Device.status = INSTALLED, deviceToken issued (cleartext returned once)
//   • Subscription.deviceId = device.id   (1:1 — `@unique` on Subscription)
//   • Any open INSTALL Job for this booking is closed as DONE
//   • Customer gets an in-app notification
//
// The ESP32 then polls /state with the token; once subscription.status=ACTIVE
// + now < expiresAt, allowFlow becomes true. A subsequent /:id/recharge call
// extends expiresAt → the *same* device's next state poll returns allowFlow=true
// without any other plumbing.
//
// Deallocate reverses the binding (for swaps / returns).

const allocateSchema = z.object({
  subscriptionId: z.string(),
  // Issue a fresh token on allocation. Set false when re-paring an already-
  // tokenised device (e.g. RMA swap where the firmware was flashed elsewhere).
  issueToken: z.boolean().default(true),
});

// Allocate logic — exported so both the admin REST endpoint and the
// technician WhatsApp flow can share the exact same state transition.
export async function allocateDevice(args: {
  serial: string;
  subscriptionId: string;
  issueToken: boolean;
  actorUserId: string | null;
}) {
  const device = await prisma.device.findUnique({
    where: { serial: args.serial },
    include: { subscription: true },
  });
  if (!device) throw NotFound('Device not found');
  if (device.status === 'RETIRED') throw BadRequest('Device is retired');
  if (device.subscription && device.subscription.id !== args.subscriptionId) {
    throw Conflict(`Device already paired with subscription ${device.subscription.id}`);
  }

  const sub = await prisma.subscription.findUnique({
    where: { id: args.subscriptionId },
    include: { device: true, booking: true },
  });
  if (!sub) throw NotFound('Subscription not found');
  if (sub.deviceId && sub.deviceId !== device.id) {
    throw Conflict(
      `Subscription already has device ${sub.device?.serial ?? sub.deviceId}; deallocate first`
    );
  }
  if (sub.productId !== device.productId) {
    throw BadRequest(
      `Device product mismatch: device is ${device.productId}, subscription expects ${sub.productId}`
    );
  }

  const token = args.issueToken
    ? randomBytes(24).toString('base64url')
    : device.deviceToken ?? randomBytes(24).toString('base64url');

  return prisma.$transaction(async (tx) => {
    const d = await tx.device.update({
      where: { id: device.id },
      data: { status: 'INSTALLED', deviceToken: token },
    });
    const s = await tx.subscription.update({
      where: { id: sub.id },
      data: { deviceId: d.id },
    });
    await tx.job.updateMany({
      where: {
        bookingId: sub.bookingId,
        type: 'INSTALL',
        status: { in: ['SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS'] },
      },
      data: { status: 'DONE', completedAt: new Date() },
    });
    await tx.notification.create({
      data: {
        userId: sub.userId,
        channel: 'INAPP',
        title: 'Your purifier is now active',
        body: `Device ${d.serial} has been installed and paired to your plan.`,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: args.actorUserId,
        action: 'DEVICE_ALLOCATE',
        entity: 'Device',
        entityId: d.id,
        after: JSON.stringify({ subscriptionId: s.id, serial: d.serial }),
      },
    });
    return { device: d, subscription: s };
  });
}

router.post(
  '/admin/:serial/allocate',
  authRequired(['ADMIN']),
  validateBody(allocateSchema),
  asyncHandler(async (req, res) => {
    const { subscriptionId, issueToken } = req.body as z.infer<typeof allocateSchema>;
    const result = await allocateDevice({
      serial: req.params.serial,
      subscriptionId,
      issueToken,
      actorUserId: req.auth!.sub,
    });
    res.json({ data: result });
  })
);

router.post(
  '/admin/:serial/deallocate',
  authRequired(['ADMIN']),
  validateBody(z.object({ reason: z.string().max(280).optional() }).default({})),
  asyncHandler(async (req, res) => {
    const device = await prisma.device.findUnique({
      where: { serial: req.params.serial },
      include: { subscription: true },
    });
    if (!device) throw NotFound('Device not found');
    if (!device.subscription) throw BadRequest('Device is not currently allocated');

    const subId = device.subscription.id;

    const result = await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subId },
        data: { deviceId: null },
      });
      const d = await tx.device.update({
        where: { id: device.id },
        data: { status: 'RETURNED', deviceToken: null },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: req.auth!.sub,
          action: 'DEVICE_DEALLOCATE',
          entity: 'Device',
          entityId: d.id,
          before: JSON.stringify({ subscriptionId: subId }),
          after: JSON.stringify({ reason: req.body.reason ?? null }),
        },
      });
      return { device: d, subscriptionId: subId };
    });
    res.json({ data: result });
  })
);

// Dispatch queue — ops view of pairings to do. Returns:
//   - subscriptions needing a device (paid booking, no deviceId), grouped by
//     productId so the right warehouse SKU is obvious
//   - warehouse devices available for each productId
//
// Optional ?cityId=... filter narrows by booking city (zone-aware dispatch).
router.get(
  '/admin/dispatch',
  authRequired(['ADMIN']),
  asyncHandler(async (req, res) => {
    const cityId = (req.query.cityId as string | undefined) ?? undefined;
    const subs = await prisma.subscription.findMany({
      where: {
        deviceId: null,
        status: { in: ['ACTIVE', 'TRIAL', 'GRACE'] },
        ...(cityId ? { booking: { cityId } } : {}),
      },
      include: {
        booking: { include: { city: true } },
        user: { select: { id: true, fullName: true, phone: true } },
        product: { select: { id: true, name: true, capacityLitres: true } },
        plan: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const productIds = Array.from(new Set(subs.map((s) => s.productId)));
    const warehouse = productIds.length
      ? await prisma.device.findMany({
          where: { status: 'WAREHOUSE', productId: { in: productIds } },
          select: { id: true, serial: true, qr: true, productId: true, warehouse: true },
          orderBy: { serial: 'asc' },
        })
      : [];

    const byProduct: Record<string, { subs: typeof subs; devices: typeof warehouse }> = {};
    for (const id of productIds) byProduct[id] = { subs: [], devices: [] };
    subs.forEach((s) => byProduct[s.productId]!.subs.push(s));
    warehouse.forEach((d) => {
      if (byProduct[d.productId]) byProduct[d.productId]!.devices.push(d);
    });

    res.json({ data: { byProduct, subsAwaiting: subs.length, devicesAvailable: warehouse.length } });
  })
);

// ───────────────────────────────────── Admin token-only ────────────────────────────────────
// Standalone token issue/regenerate — kept for back-compat with the original
// install flow. Prefer /allocate which does this atomically with subscription
// binding.

router.post(
  '/admin/:serial/issue-token',
  authRequired(['ADMIN']),
  asyncHandler(async (req, res) => {
    const device = await prisma.device.findUnique({ where: { serial: req.params.serial } });
    if (!device) throw NotFound('Device not found');
    const token = randomBytes(24).toString('base64url');
    const updated = await prisma.device.update({
      where: { id: device.id },
      data: { deviceToken: token },
      select: { id: true, serial: true, deviceToken: true },
    });
    res.json({ data: updated });
  })
);

// Admin can quickly look up state without a token (for debugging)
router.get(
  '/admin/:serial/state',
  authRequired(['ADMIN']),
  asyncHandler(async (req, res) => {
    const device = await prisma.device.findUnique({
      where: { serial: req.params.serial },
      include: { subscription: { include: { user: { select: { id: true, fullName: true, phone: true } } } } },
    });
    if (!device) throw NotFound('Device not found');
    const isOnline = device.lastHeartbeatAt
      ? Date.now() - new Date(device.lastHeartbeatAt).getTime() < 90 * 60 * 1000
      : false;
    res.json({ data: { ...device, isOnline } });
  })
);

export default router;
