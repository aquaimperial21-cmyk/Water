// ESP32 hardware integration.
// These endpoints are NOT JWT-protected; they validate a per-device token
// stored on the Device row. The hardware polls /state to decide whether to
// open or close its solenoid valve, and posts /heartbeat to declare itself
// alive + report firmware/wifi. Remote firmware updates ride on /state and
// use /firmware/:releaseId + /ota-report (rules in core/firmware.ts).

import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../core/prisma';
import { authRequired } from '../core/auth';
import { asyncHandler, BadRequest, Conflict, NotFound, Unauthorized } from '../core/errors';
import { validateBody } from '../core/validate';
import { hideToken, localKeyFor } from '../core/device-token';
import { parseGraceDays, pollIntervalSec as computePollIntervalSec, TEST_PRODUCT_TAG } from '../core/poll-schedule';
import { presenceOf } from '../core/device-online';
import {
  FIRMWARE_VERSION_RE,
  OTA_REPORT_STATUSES,
  mayDownload,
  recordOtaReport,
  syncDeviceFirmware,
} from '../core/firmware';
import { UPLOAD_ROOT } from './upload';

const router = Router();

// Grace days: device keeps flowing for N days after subscription expires.
// A malformed value falls back to 0 instead of NaN (which would stop all water).
const GRACE_DAYS = parseGraceDays(process.env.DEVICE_GRACE_DAYS);

async function authorizeDevice(serial: string, token: string | undefined) {
  if (!token) throw Unauthorized('Missing device token');
  const device = await prisma.device.findUnique({
    where: { serial },
    include: { subscription: { include: { user: true, product: { select: { tag: true } } } } },
  });
  if (!device) throw NotFound('Device not found');
  if (!device.deviceToken || device.deviceToken !== token) throw Unauthorized('Invalid device token');
  return device;
}

// lastSeenAt is written at most this often, so a chip polling every minute
// (test plans, just after a plan ends) doesn't write the row on every poll.
const SEEN_WRITE_EVERY_MS = 60 * 1000;

/**
 * A home-LAN IPv4 address (10.x, 172.16–31.x, 192.168.x) in plain dotted form,
 * or null for anything else: missing, public, malformed, leading zeros.
 */
function privateLanIpv4(raw: string | undefined): string | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec((raw ?? '').trim());
  if (!m) return null;
  const parts = m.slice(1);
  if (parts.some((p) => p.length > 1 && p.startsWith('0'))) return null;
  const [a, b, c, d] = parts.map(Number) as [number, number, number, number];
  if ([a, b, c, d].some((n) => n > 255)) return null;
  const isPrivate = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  return isPrivate ? `${a}.${b}.${c}.${d}` : null;
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

    // Polling hint: daily while a plan is comfortably paid, hourly in the last
    // 3 days, fast just after the end so a recharge turns the water back on
    // quickly. The schedule lives in core/poll-schedule.ts.
    const pollIntervalSec = computePollIntervalSec({
      subscription: sub,
      allowFlow,
      graceDays: GRACE_DAYS,
      now: Date.now(),
      fastPoll: sub?.product?.tag === TEST_PRODUCT_TAG,
    });

    // Remote update: the chip sends the version it runs; `firmware` is present
    // only when a newer (or replacement) release is rolled out to it. A
    // malformed header is ignored rather than failing the poll.
    const fwHeader = req.header('x-firmware-version');
    const runningVersion = fwHeader && FIRMWARE_VERSION_RE.test(fwHeader) ? fwHeader : undefined;

    // Presence: when the chip was last heard from (drives "online"), and its
    // home-LAN address from the optional X-Local-Ip header, so the app can
    // reach it even between heartbeats. Anything but a private IPv4 is
    // ignored. Written only when it changes, in the same update as the
    // firmware bookkeeping.
    const seenNow = new Date();
    const presence: Prisma.DeviceUpdateInput = {};
    if (!device.lastSeenAt || seenNow.getTime() - device.lastSeenAt.getTime() > SEEN_WRITE_EVERY_MS) {
      presence.lastSeenAt = seenNow;
    }
    const localIp = privateLanIpv4(req.header('x-local-ip'));
    if (localIp && localIp !== device.localIp) presence.localIp = localIp;

    const firmware = await syncDeviceFirmware(device, runningVersion, presence);

    res.json({
      data: {
        allowFlow,
        status,
        expiresAt,
        graceDays: GRACE_DAYS,
        pollIntervalSec,
        message,
        serverTime: new Date().toISOString(),
        ...(firmware ? { firmware } : {}),
      },
    });
  })
);

// The signed image of a release rolled out to this unit. 404 for anything
// else, so serials can't be used to probe which releases exist.
router.get(
  '/:serial/firmware/:releaseId',
  asyncHandler(async (req, res, next) => {
    const token = (req.query.token as string | undefined) ?? req.header('x-device-token') ?? undefined;
    const device = await authorizeDevice(req.params.serial, token);
    const release = await prisma.firmwareRelease.findUnique({ where: { id: req.params.releaseId } });
    if (!release || !mayDownload(release, device)) throw NotFound('Firmware release not found');

    res.sendFile(
      release.filePath,
      {
        root: UPLOAD_ROOT,
        dotfiles: 'deny',
        cacheControl: false,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Cache-Control': 'no-store',
          'X-Firmware-Version': release.version,
          'X-Firmware-Sha256': release.sha256,
        },
      },
      (err?: Error & { code?: string; status?: number }) => {
        if (!err) return;
        if (res.headersSent) return; // client went away mid-download
        next(err.status === 404 || err.code === 'ENOENT' ? NotFound('Firmware file missing') : err);
      }
    );
  })
);

const otaReportSchema = z.object({
  releaseId: z.string().min(1).max(64),
  status: z.enum(OTA_REPORT_STATUSES),
  error: z.string().max(200).optional(),
  version: z.string().regex(FIRMWARE_VERSION_RE).optional(),
});

// Progress of a remote update, posted by the chip: DOWNLOADING when it starts,
// INSTALLED once the new image runs, FAILED (download/verify/flash error) or
// ROLLED_BACK (new image did not come up). Offers of a release stop after 3
// FAILED reports until an admin presses retry.
router.post(
  '/:serial/ota-report',
  validateBody(otaReportSchema),
  asyncHandler(async (req, res) => {
    const token = (req.query.token as string | undefined) ?? req.header('x-device-token') ?? undefined;
    const device = await authorizeDevice(req.params.serial, token);
    await recordOtaReport(device, req.body as z.infer<typeof otaReportSchema>);
    res.json({ data: { ok: true } });
  })
);

const heartbeatSchema = z.object({
  firmwareVersion: z.string().max(40).optional(),
  wifiSsid: z.string().max(80).optional(),
  // Home-LAN address, so the customer app can reach the ESP32 over Wi-Fi.
  localIp: z.string().ip({ version: 'v4' }).optional(),
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
      const now = new Date();
      const dev = await tx.device.update({
        where: { id: device.id },
        data: {
          lastHeartbeatAt: now,
          // The row is written anyway, so lastSeenAt needs no throttling here.
          lastSeenAt: now,
          firmwareVersion: body.firmwareVersion ?? device.firmwareVersion,
          wifiSsid: body.wifiSsid ?? device.wifiSsid,
          localIp: body.localIp ?? device.localIp,
          lastTdsPpm: body.tdsPpm ?? device.lastTdsPpm,
          filterLifePct: body.filterLifePct ?? device.filterLifePct,
          usageLitresTotal: body.usageLitresDelta
            ? device.usageLitresTotal + body.usageLitresDelta
            : device.usageLitresTotal,
          leakDetectedAt: body.leak ? new Date() : device.leakDetectedAt,
        },
        select: {
          id: true, lastHeartbeatAt: true, lastSeenAt: true, firmwareVersion: true, wifiSsid: true, localIp: true,
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

/**
 * The plan whose purifier is at the customer's home: the newest plan with a
 * purifier paired, in any status. A newer plan without one (every booking
 * before its installation) must not hide the purifier already on the wall.
 * /me/health, /me/readings and /me/local-access all read this one plan, so
 * the device dashboard and the water switch show the same purifier.
 */
function homePurifierPlan(userId: string) {
  return {
    where: { userId, deviceId: { not: null } },
    orderBy: { createdAt: 'desc' },
  } satisfies Prisma.SubscriptionFindFirstArgs;
}

router.get(
  '/me/health',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const sub = await prisma.subscription.findFirst({
      ...homePurifierPlan(req.auth!.sub),
      include: { device: true, plan: true },
    });
    if (!sub?.device) {
      return res.json({ data: null });
    }
    const dev = sub.device;
    res.json({
      data: {
        serial: dev.serial,
        ...presenceOf(dev),
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
      ...homePurifierPlan(req.auth!.sub),
      select: { deviceId: true },
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

// What the customer app needs to switch the water on/off over the home Wi-Fi:
// the ESP32's LAN address and the key to sign commands with. The key is derived
// from the device token; the token itself never leaves the server. Any
// subscription status counts — turning the water OFF must keep working on an
// unpaid plan, and the ESP32 refuses ON by itself.
router.get(
  '/me/local-access',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const sub = await prisma.subscription.findFirst({
      ...homePurifierPlan(req.auth!.sub),
      include: { device: true },
    });
    res.set('Cache-Control', 'no-store');
    const dev = sub?.device;
    if (!dev) return res.json({ data: null });
    res.json({
      data: {
        serial: dev.serial,
        localIp: dev.localIp,
        localKey: dev.deviceToken ? localKeyFor(dev.deviceToken) : null,
        lastHeartbeatAt: dev.lastHeartbeatAt,
        ...presenceOf(dev),
      },
    });
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
      return { device: hideToken(d), subscriptionId: subId };
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

// Replaces the token, so the purifier is cut off until the new one is flashed.
router.post(
  '/admin/:serial/issue-token',
  authRequired(['ADMIN']),
  asyncHandler(async (req, res) => {
    const device = await prisma.device.findUnique({ where: { serial: req.params.serial } });
    if (!device) throw NotFound('Device not found');
    const token = randomBytes(24).toString('base64url');
    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.device.update({
        where: { id: device.id },
        data: { deviceToken: token },
        select: { id: true, serial: true, deviceToken: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: req.auth!.sub,
          action: 'DEVICE_TOKEN_ISSUE',
          entity: 'Device',
          entityId: d.id,
          after: JSON.stringify({ serial: d.serial, hadToken: Boolean(device.deviceToken) }),
        },
      });
      return d;
    });
    res.set('Cache-Control', 'no-store');
    // `deviceToken` stays for older callers.
    res.json({ data: { ...updated, token } });
  })
);

// Shows the current token so a technician can flash it onto the ESP32.
// Every view is audited.
router.get(
  '/admin/:serial/token',
  authRequired(['ADMIN']),
  asyncHandler(async (req, res) => {
    const device = await prisma.device.findUnique({
      where: { serial: req.params.serial },
      select: { id: true, serial: true, deviceToken: true },
    });
    if (!device) throw NotFound('Device not found');
    if (!device.deviceToken) throw NotFound('Device has no token');
    await prisma.auditLog.create({
      data: {
        actorUserId: req.auth!.sub,
        action: 'DEVICE_TOKEN_VIEW',
        entity: 'Device',
        entityId: device.id,
        after: JSON.stringify({ serial: device.serial }),
      },
    });
    res.set('Cache-Control', 'no-store');
    res.json({ data: { serial: device.serial, token: device.deviceToken } });
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
    res.json({ data: { ...hideToken(device), ...presenceOf(device) } });
  })
);

export default router;
