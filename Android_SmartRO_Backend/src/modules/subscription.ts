import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../core/prisma';
import { authRequired } from '../core/auth';
import { BadRequest, NotFound, Forbidden, asyncHandler } from '../core/errors';
import { validateBody } from '../core/validate';
import { termPricePaise } from '../core/pricing';
import { nextInvoiceNumber } from '../core/invoice';
import { assertStubPaymentsAllowed } from '../core/payments';
import { cancelMandate } from '../services/razorpay';

const router = Router();

// 7-day risk-free trial: subscription.trialEndsAt is set at install (see
// booking.ts settlePayment / pay). A cancel inside trial returns the full
// deposit + first month; a cancel after lock-in returns only the deposit
// (post quality inspection). A cancel between trial-end and lock-in is
// blocked (returned as 403 with the lockInUntil date so the UI can explain).
const TRIAL_DAYS = Number(process.env.TRIAL_DAYS ?? 7);

router.get(
  '/me',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const subs = await prisma.subscription.findMany({
      where: { userId: req.auth!.sub },
      include: { product: true, plan: true, device: true, booking: { include: { city: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: subs });
  })
);

router.get(
  '/',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const subs = await prisma.subscription.findMany({
      include: {
        product: true,
        plan: true,
        device: true,
        user: { select: { id: true, fullName: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: subs });
  })
);

const PAYMENT_STUB_DELAY_MS = Number(process.env.PAYMENT_STUB_DELAY_MS ?? 1500);

router.post(
  '/:id/recharge',
  authRequired(['CUSTOMER']),
  validateBody(z.object({ planId: z.string().optional() }).default({})),
  asyncHandler(async (req, res) => {
    // Extends the plan without charging anything — dev only.
    assertStubPaymentsAllowed();
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: { plan: true, booking: true },
    });
    if (!sub || sub.userId !== req.auth!.sub) throw NotFound('Subscription not found');
    // A cancelled plan has been refunded and the device collected. Recharging
    // it charged the customer and flipped it back to ACTIVE.
    if (sub.status === 'CLOSED') throw BadRequest('This plan is closed; start a new booking');
    if (sub.status === 'PAUSED') throw BadRequest('Resume the plan before recharging it');

    const targetPlanId = req.body.planId ?? sub.planId;
    const price = await prisma.planCityPrice.findUnique({
      where: {
        planId_cityId_productId: {
          planId: targetPlanId,
          cityId: sub.booking.cityId,
          productId: sub.productId,
        },
      },
      include: { plan: true },
    });
    if (!price) throw BadRequest('No pricing found for this plan/city/product combination');

    // The recharge below grants a whole term, so charge for a whole term.
    const amountPaise = termPricePaise(price.monthlyPricePaise, price.plan.durationDays);

    const payment = await prisma.payment.create({
      data: {
        userId: sub.userId,
        subscriptionId: sub.id,
        kind: 'RECHARGE',
        amountPaise,
        status: 'INITIATED',
        gatewayRef: `STUB_${Date.now()}`,
        targetPlanId,
      },
    });
    await new Promise((r) => setTimeout(r, PAYMENT_STUB_DELAY_MS));

    const baseFromExpiry = sub.expiresAt > new Date() ? sub.expiresAt : new Date();
    const newExpiresAt = new Date(baseFromExpiry.getTime() + price.plan.durationDays * 24 * 60 * 60 * 1000);

    const result = await prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'SUCCESS' } });
      await tx.invoice.create({
        data: {
          paymentId: payment.id,
          number: await nextInvoiceNumber(tx),
          amountPaise,
          gstPaise: Math.round(amountPaise * 0.18),
        },
      });
      const updated = await tx.subscription.update({
        where: { id: sub.id },
        data: {
          expiresAt: newExpiresAt,
          status: 'ACTIVE',
          planId: targetPlanId,
        },
      });
      await tx.notification.create({
        data: {
          userId: sub.userId,
          channel: 'INAPP',
          title: 'Recharge successful',
          body: `Your plan is extended to ${newExpiresAt.toDateString()}.`,
        },
      });
      return updated;
    });

    res.json({ data: result });
  })
);

// ─────────────────────────── Pause / Resume ───────────────────────────
//
// Pause stops billing forward (autopay debits suspended at the gateway too if
// linked) and freezes `expiresAt` advancement. Resume restores ACTIVE.

router.post(
  '/:id/pause',
  authRequired(['CUSTOMER']),
  validateBody(z.object({ reason: z.string().max(280).optional() }).default({})),
  asyncHandler(async (req, res) => {
    const sub = await prisma.subscription.findUnique({ where: { id: req.params.id } });
    if (!sub || sub.userId !== req.auth!.sub) throw NotFound('Subscription not found');
    if (sub.status === 'CLOSED' || sub.status === 'CANCELLED' as any)
      throw BadRequest('Subscription is closed');
    if (sub.status === 'PAUSED') return res.json({ data: sub });

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'PAUSED', pausedAt: new Date() },
    });
    await prisma.notification.create({
      data: {
        userId: sub.userId,
        channel: 'INAPP',
        title: 'Subscription paused',
        body: 'Your purifier flow is on hold. Resume anytime from the app.',
      },
    });
    res.json({ data: updated });
  })
);

router.post(
  '/:id/resume',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const sub = await prisma.subscription.findUnique({ where: { id: req.params.id } });
    if (!sub || sub.userId !== req.auth!.sub) throw NotFound('Subscription not found');
    if (sub.status !== 'PAUSED') throw BadRequest('Subscription is not paused');
    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'ACTIVE', resumedAt: new Date() },
    });
    await prisma.notification.create({
      data: {
        userId: sub.userId,
        channel: 'INAPP',
        title: 'Subscription resumed',
        body: 'Welcome back — flow is on.',
      },
    });
    res.json({ data: updated });
  })
);

// ─────────────────────────── Cancel + refund ───────────────────────────
//
// Refund policy:
//   - Inside trial window  → 100% (deposit + first month rent)
//   - After lock-in        → deposit only (pending quality inspection)
//   - Between trial & lock-in → blocked (UI explains the lockInUntil date)

router.post(
  '/:id/cancel',
  authRequired(['CUSTOMER']),
  validateBody(z.object({ reason: z.string().max(280).optional() }).default({})),
  asyncHandler(async (req, res) => {
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: { booking: true },
    });
    if (!sub || sub.userId !== req.auth!.sub) throw NotFound('Subscription not found');
    if (sub.status === 'CLOSED') return res.json({ data: { subscription: sub, refundPaise: 0 } });

    const now = new Date();
    const inTrial = sub.trialEndsAt ? now < sub.trialEndsAt : false;
    const afterLockIn = now >= sub.lockInUntil;
    if (!inTrial && !afterLockIn) {
      throw Forbidden(
        `Cancellation locked until ${sub.lockInUntil.toISOString()}. Contact support for exceptions.`
      );
    }

    const totalDeposit = sub.booking.depositPaise;
    const totalFirstMonth = sub.booking.firstPaymentPaise;
    const refundPaise = inTrial ? totalDeposit + totalFirstMonth : totalDeposit;

    // Stop the mandate BEFORE closing the row. Left live, Razorpay keeps
    // debiting a cancelled, refunded customer every cycle, and the charge
    // webhook flips the subscription back to ACTIVE.
    // The refund webhook arrives knowing only the gateway payment it reverses,
    // so the queued refund has to carry that id or it can never be matched.
    const originalPayment = await prisma.payment.findFirst({
      where: {
        userId: sub.userId,
        bookingId: sub.bookingId,
        kind: 'DEPOSIT',
        status: 'SUCCESS',
        gatewayPaymentId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    let mandateCancelled = false;
    if (sub.autopayId) {
      try {
        await cancelMandate(sub.autopayId, false);
        mandateCancelled = true;
      } catch (e) {
        // Don't strand the cancellation: record it and let ops clear the
        // mandate, but make the failure loud.
        // eslint-disable-next-line no-console
        console.error(`[cancel] could not cancel mandate ${sub.autopayId} for subscription ${sub.id}`, e);
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const refund = await tx.payment.create({
        data: {
          userId: sub.userId,
          subscriptionId: sub.id,
          bookingId: sub.bookingId,
          kind: 'REFUND',
          amountPaise: refundPaise,
          // Refunds are queued in INITIATED — settled by ops or by the
          // Razorpay refund webhook (see modules/payment.ts).
          status: 'INITIATED',
          gatewayRef: `REFUND_PENDING_${Date.now()}`,
          gatewayPaymentId: originalPayment?.gatewayPaymentId ?? null,
        },
      });
      const updatedSub = await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'CLOSED',
          cancelledAt: now,
          cancelReason: req.body.reason ?? (inTrial ? 'TRIAL_CANCEL' : 'POST_LOCKIN_CANCEL'),
          ...(sub.autopayId
            ? { autopayStatus: mandateCancelled ? 'CANCELLED' : 'CANCEL_FAILED' }
            : {}),
        },
      });
      await tx.booking.update({
        where: { id: sub.bookingId },
        data: { status: 'CANCELLED', cancelledAt: now, cancelReason: updatedSub.cancelReason },
      });
      // Release device back to warehouse-pickup state
      if (sub.deviceId) {
        await tx.device.update({
          where: { id: sub.deviceId },
          data: { status: 'IN_SERVICE' },
        });
        // PICKUP ticket so ops can collect the unit
        await tx.ticket.create({
          data: {
            userId: sub.userId,
            subscriptionId: sub.id,
            deviceId: sub.deviceId,
            category: 'PICKUP',
            description: `Pickup after cancellation (${updatedSub.cancelReason})`,
            status: 'OPEN',
            priority: 'HIGH',
            slaDueAt: new Date(now.getTime() + 72 * 3600 * 1000),
          },
        });
      }
      await tx.notification.create({
        data: {
          userId: sub.userId,
          channel: 'INAPP',
          title: 'Cancellation received',
          body: `Refund of ₹${Math.round(refundPaise / 100)} will be processed in 5–7 working days.`,
        },
      });
      return { subscription: updatedSub, refundPayment: refund, refundPaise };
    });

    res.json({ data: result });
  })
);

// Convenience helper used by booking.ts when scheduling a pre-install cancel
// (booking still in PENDING_KYC / PENDING_PAY).
router.post(
  '/booking/:bookingId/cancel',
  authRequired(['CUSTOMER']),
  validateBody(z.object({ reason: z.string().max(280).optional() }).default({})),
  asyncHandler(async (req, res) => {
    const b = await prisma.booking.findUnique({ where: { id: req.params.bookingId } });
    if (!b || b.userId !== req.auth!.sub) throw NotFound('Booking not found');
    if (b.status === 'INSTALLED' || b.status === 'PAID')
      throw BadRequest('Subscription is already active — use /subscriptions/:id/cancel');
    const updated = await prisma.booking.update({
      where: { id: b.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: req.body.reason ?? 'PRE_INSTALL_CANCEL',
      },
    });
    res.json({ data: updated });
  })
);

// Re-export for cron / webhooks
export const _trialDays = TRIAL_DAYS;

export default router;
