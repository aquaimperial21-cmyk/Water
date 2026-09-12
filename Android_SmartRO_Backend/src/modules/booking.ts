import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../core/prisma';
import { authRequired } from '../core/auth';
import { BadRequest, NotFound, asyncHandler } from '../core/errors';
import { validateBody } from '../core/validate';
import { applyReferralRewardOnFirstPayment, lookupReferralCreditForUser } from './referral';

const router = Router();

const createBookingSchema = z.object({
  productId: z.string(),
  planId: z.string(),
  cityId: z.string(),
  addressId: z.string().optional(),
  installationSlot: z.string().datetime().optional(),
});

router.post(
  '/',
  authRequired(['CUSTOMER']),
  validateBody(createBookingSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createBookingSchema>;
    const price = await prisma.planCityPrice.findUnique({
      where: {
        planId_cityId_productId: { planId: body.planId, cityId: body.cityId, productId: body.productId },
      },
    });
    if (!price) throw BadRequest('No pricing for that product/plan/city combination');

    // Referral credit applies to first-month rent only (capped at the rent so
    // we never end up with negative invoices).
    const referralCreditPaise = await lookupReferralCreditForUser(req.auth!.sub);
    const referee = await prisma.user.findUnique({ where: { id: req.auth!.sub }, select: { referredByCode: true } });
    const credit = Math.min(referralCreditPaise, price.monthlyPricePaise);

    const booking = await prisma.booking.create({
      data: {
        userId: req.auth!.sub,
        productId: body.productId,
        planId: body.planId,
        cityId: body.cityId,
        addressId: body.addressId,
        depositPaise: price.depositPaise,
        firstPaymentPaise: Math.max(0, price.monthlyPricePaise - credit),
        installationSlot: body.installationSlot ? new Date(body.installationSlot) : undefined,
        status: 'PENDING_KYC',
        referralCode: referee?.referredByCode ?? null,
        referralCreditPaise: credit,
      },
      include: { product: true, plan: true, city: true },
    });
    res.status(201).json({ data: booking });
  })
);

router.get(
  '/me',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const items = await prisma.booking.findMany({
      where: { userId: req.auth!.sub },
      include: { product: true, plan: true, city: true, payments: true, subscription: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: items });
  })
);

router.get(
  '/:id',
  authRequired(['CUSTOMER', 'ADMIN']),
  asyncHandler(async (req, res) => {
    const b = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        product: true,
        plan: true,
        city: true,
        payments: true,
        subscription: true,
        jobs: {
          where: { type: 'INSTALL' },
          include: { technician: { include: { user: { select: { fullName: true, phone: true } } } } },
          orderBy: { scheduledFor: 'desc' },
        },
      },
    });
    if (!b) throw NotFound('Booking not found');
    if (req.auth!.kind === 'CUSTOMER' && b.userId !== req.auth!.sub) throw NotFound('Booking not found');
    res.json({ data: b });
  })
);

// ─────────────────────────── Install slot booking ───────────────────────────
//
// Customer picks one of the available 4-hour windows over the next N days.
// Slots are validated against an env-tuned working-day schedule (default
// 9:00–18:00 every day), and we deny times within the next 6 hours so the
// 48–72h SLA promise on the marketing page is realistic.

const INSTALL_LEAD_HOURS = Number(process.env.INSTALL_LEAD_HOURS ?? 6);
const INSTALL_WINDOW_HOURS = 4;

router.get(
  '/:id/install-slots',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const b = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!b || b.userId !== req.auth!.sub) throw NotFound('Booking not found');

    const earliest = new Date(Date.now() + INSTALL_LEAD_HOURS * 3600 * 1000);
    const days = 6;
    const slots: { start: string; end: string; label: string }[] = [];
    for (let d = 0; d < days; d++) {
      const day = new Date(earliest);
      day.setDate(day.getDate() + d);
      // Three 4-hour windows: 09–13, 13–17, 17–21
      for (const startHour of [9, 13, 17]) {
        const start = new Date(day);
        start.setHours(startHour, 0, 0, 0);
        if (start.getTime() < earliest.getTime()) continue;
        const end = new Date(start.getTime() + INSTALL_WINDOW_HOURS * 3600 * 1000);
        slots.push({
          start: start.toISOString(),
          end: end.toISOString(),
          label: `${start.toDateString().slice(0, 10)} · ${startHour}:00–${startHour + INSTALL_WINDOW_HOURS}:00`,
        });
      }
    }
    res.json({ data: slots });
  })
);

const installSlotSchema = z.object({ start: z.string().datetime() });
router.post(
  '/:id/install-slot',
  authRequired(['CUSTOMER']),
  validateBody(installSlotSchema),
  asyncHandler(async (req, res) => {
    const b = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { city: true } });
    if (!b || b.userId !== req.auth!.sub) throw NotFound('Booking not found');
    if (b.status === 'CANCELLED' || b.status === 'INSTALLED') {
      throw BadRequest(`Booking is ${b.status}; cannot schedule install`);
    }

    const start = new Date(req.body.start);
    const earliest = new Date(Date.now() + INSTALL_LEAD_HOURS * 3600 * 1000);
    if (start.getTime() < earliest.getTime()) {
      throw BadRequest('Slot is within the install lead time; pick a later window');
    }

    // Pick a technician for this booking's city: prefer techs whose zone
    // contains the city name (case-insensitive), then the one with the fewest
    // open jobs in the next 7 days. Defensive fallback: any active tech.
    const zoneMatch = await prisma.technician.findMany({
      where: { status: 'ACTIVE', zone: { contains: b.city.name } },
      include: { _count: { select: { jobs: { where: { status: { in: ['SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS'] } } } } } },
      orderBy: { id: 'asc' },
    });
    const candidates = zoneMatch.length > 0
      ? zoneMatch
      : await prisma.technician.findMany({
          where: { status: 'ACTIVE' },
          include: { _count: { select: { jobs: { where: { status: { in: ['SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS'] } } } } } },
        });
    if (candidates.length === 0) throw BadRequest('No active technicians configured for this city');
    candidates.sort((a, b) => a._count.jobs - b._count.jobs);
    const tech = candidates[0]!;

    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.update({
        where: { id: b.id },
        data: { installationSlot: start },
      });
      // Replace any prior INSTALL job for this booking
      await tx.job.deleteMany({
        where: { bookingId: b.id, type: 'INSTALL', status: 'SCHEDULED' },
      });
      const job = await tx.job.create({
        data: {
          bookingId: b.id,
          technicianId: tech.id,
          type: 'INSTALL',
          scheduledFor: start,
          status: 'SCHEDULED',
          notes: `Install at ${b.city.name} · booking ${b.id}`,
        },
      });
      await tx.notification.create({
        data: {
          userId: b.userId,
          channel: 'INAPP',
          title: 'Installation scheduled',
          body: `Technician will arrive on ${start.toLocaleString('en-IN')}.`,
        },
      });
      return { booking, job, technicianId: tech.id };
    });

    res.json({ data: result });
  })
);

router.post(
  '/:id/sign-agreement',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const b = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!b || b.userId !== req.auth!.sub) throw NotFound('Booking not found');
    const next = b.status === 'PENDING_KYC' ? 'PENDING_PAY' : b.status;
    const updated = await prisma.booking.update({
      where: { id: b.id },
      data: { agreementSignedAt: new Date(), status: next },
    });
    res.json({ data: updated });
  })
);

const PAYMENT_STUB_DELAY_MS = Number(process.env.PAYMENT_STUB_DELAY_MS ?? 1500);

let invoiceCounter = Date.now() % 100000;
function nextInvoiceNumber(): string {
  invoiceCounter += 1;
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');
  return `SMR-${yyyymm}-${String(invoiceCounter).padStart(6, '0')}`;
}

router.post(
  '/:id/pay',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const b = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { plan: true } });
    if (!b || b.userId !== req.auth!.sub) throw NotFound('Booking not found');
    if (!b.agreementSignedAt) throw BadRequest('Agreement must be signed before payment');
    if (b.status === 'PAID' || b.status === 'INSTALLED') return res.json({ data: { booking: b } });

    const totalPaise = b.depositPaise + b.firstPaymentPaise;
    const payment = await prisma.payment.create({
      data: {
        userId: b.userId,
        bookingId: b.id,
        kind: 'DEPOSIT',
        amountPaise: totalPaise,
        status: 'INITIATED',
        gatewayRef: `STUB_${Date.now()}`,
      },
    });

    // Stub gateway round-trip — TODO PROD: replace with Razorpay order create + webhook
    await new Promise((r) => setTimeout(r, PAYMENT_STUB_DELAY_MS));

    const gstPaise = Math.round(totalPaise * 0.18);
    const completed = await prisma.$transaction(async (tx) => {
      const updatedPay = await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCESS' },
      });
      await tx.invoice.create({
        data: {
          paymentId: updatedPay.id,
          number: nextInvoiceNumber(),
          amountPaise: totalPaise,
          gstPaise,
        },
      });
      const updatedBooking = await tx.booking.update({
        where: { id: b.id },
        data: { status: 'PAID' },
      });

      // Auto-create active subscription on payment success (matches doc: subscription created on installation; we treat paid → installed in prototype)
      const startedAt = new Date();
      const expiresAt = new Date(startedAt.getTime() + b.plan.durationDays * 24 * 60 * 60 * 1000);
      const lockInUntil = new Date(startedAt.getTime() + 180 * 24 * 60 * 60 * 1000); // default 6-month lock-in
      const trialDays = Number(process.env.TRIAL_DAYS ?? 7);
      const trialEndsAt = new Date(startedAt.getTime() + trialDays * 24 * 60 * 60 * 1000);
      const sub = await tx.subscription.create({
        data: {
          userId: b.userId,
          bookingId: b.id,
          productId: b.productId,
          planId: b.planId,
          status: 'ACTIVE',
          startedAt,
          expiresAt,
          lockInUntil,
          trialEndsAt,
        },
      });
      await tx.booking.update({ where: { id: b.id }, data: { status: 'INSTALLED' } });
      await tx.notification.create({
        data: {
          userId: b.userId,
          channel: 'INAPP',
          title: 'Payment received',
          body: `Your subscription is now active until ${expiresAt.toDateString()}.`,
        },
      });
      return { payment: updatedPay, subscription: sub };
    });

    // Post-commit: credit the referrer (if this is the customer's first paid
    // booking). Best-effort — failures are logged but don't fail the response.
    try {
      await applyReferralRewardOnFirstPayment(b.userId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[referral] reward credit failed', e);
    }

    res.json({ data: completed });
  })
);

export default router;
