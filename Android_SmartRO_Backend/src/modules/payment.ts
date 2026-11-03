// Razorpay payment endpoints.
//
//   POST /payments/bookings/:id/order      → create order for booking deposit
//   POST /payments/subscriptions/:id/order → create order for plan recharge
//   POST /payments/verify                  → verify client checkout callback
//   POST /webhooks/razorpay                → Razorpay → server webhook
//
// The first three are mounted under /api/v1/payments; the webhook is mounted
// at /api/v1/webhooks/razorpay (see app.ts).

import { Router, type Request } from 'express';
import { z } from 'zod';
import { prisma } from '../core/prisma';
import { authRequired } from '../core/auth';
import { BadRequest, Conflict, NotFound, asyncHandler, HttpError } from '../core/errors';
import { validateBody } from '../core/validate';
import { applyPaidTerm, firstTermDates, termPricePaise } from '../core/pricing';
import { nextInvoiceNumber } from '../core/invoice';
import { formatIstDate } from '../core/time';
import type { Prisma } from '@prisma/client';
import { applyReferralRewardOnFirstPayment } from './referral';
import { assertRazorpayEnabled } from '../core/payments';
import {
  cancelMandate,
  createMandatePlan,
  createMandateSubscription,
  createOrder,
  fetchOrderPayments,
  getPaymentDriver,
  getPublicKeyId,
  pauseMandate,
  resumeMandate,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from '../services/razorpay';

const router = Router();

// ─────────────────────────── Which gateway is on ───────────────────────────
//
// The app asks before paying: 'razorpay' → open Checkout with an order from the
// routes below; 'stub' → call the stub routes (/bookings/:id/pay,
// /subscriptions/:id/recharge), which only work outside production.

router.get(
  '/config',
  authRequired(['CUSTOMER']),
  (_req, res) => {
    const driver = getPaymentDriver();
    res.json({
      data: {
        driver,
        keyId: driver === 'razorpay' ? process.env.RAZORPAY_KEY_ID ?? null : null,
      },
    });
  }
);

// Every route below talks to Razorpay.
router.use((_req, _res, next) => {
  assertRazorpayEnabled();
  next();
});

// A retry must pay the order it already has. With a fresh order per tap, a
// customer whose first payment went through but showed as cancelled (Android
// UPI intent) could pay a second order for the same booking. Razorpay refuses
// a second payment on an order that is already paid.
function findOpenOrder(where: {
  kind: 'DEPOSIT' | 'RECHARGE';
  amountPaise: number;
  bookingId?: string;
  subscriptionId?: string;
  targetPlanId?: string;
}) {
  return prisma.payment.findFirst({
    where: { ...where, status: { in: ['INITIATED', 'FAILED'] }, gatewayRef: { startsWith: 'order_' } },
    orderBy: { createdAt: 'desc' },
  });
}

// ─────────────────────────── Create order: booking deposit ───────────────────────────

router.post(
  '/bookings/:id/order',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { plan: true },
    });
    if (!booking || booking.userId !== req.auth!.sub) throw NotFound('Booking not found');
    if (!booking.agreementSignedAt) throw BadRequest('Agreement must be signed before payment');
    if (booking.status === 'PAID' || booking.status === 'INSTALLED') {
      throw BadRequest('Booking is already paid');
    }
    if (booking.status === 'CANCELLED') throw BadRequest('This booking was cancelled; start a new one');

    const amountPaise = booking.depositPaise + booking.firstPaymentPaise;

    const open = await findOpenOrder({ kind: 'DEPOSIT', bookingId: booking.id, amountPaise });
    if (open?.gatewayRef) {
      return res.status(201).json({
        data: { keyId: getPublicKeyId(), orderId: open.gatewayRef, amount: amountPaise, currency: 'INR', paymentId: open.id },
      });
    }

    const payment = await prisma.payment.create({
      data: {
        userId: booking.userId,
        bookingId: booking.id,
        kind: 'DEPOSIT',
        amountPaise,
        status: 'INITIATED',
      },
    });

    const order = await createOrder({
      amountPaise,
      receipt: `pay_${payment.id}`,
      notes: { paymentId: payment.id, bookingId: booking.id, kind: 'DEPOSIT' },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { gatewayRef: order.id },
    });

    res.status(201).json({
      data: {
        keyId: getPublicKeyId(),
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        paymentId: payment.id,
      },
    });
  })
);

// ─────────────────────────── Create order: subscription recharge ───────────────────────────

router.post(
  '/subscriptions/:id/order',
  authRequired(['CUSTOMER']),
  validateBody(z.object({ planId: z.string().optional() }).default({})),
  asyncHandler(async (req, res) => {
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: { booking: true },
    });
    if (!sub || sub.userId !== req.auth!.sub) throw NotFound('Subscription not found');
    // A closed plan has been refunded and its device collected; paying again
    // would silently resurrect it.
    if (sub.status === 'CLOSED') throw BadRequest('This plan is closed; start a new booking');
    // Same rule as the stub recharge: settling would silently unpause the plan.
    if (sub.status === 'PAUSED') throw BadRequest('Resume the plan before recharging it');
    // The mandate's amount is fixed to the plan it was set up on; switching
    // plans under it would debit the old price for the new term.
    if (req.body.planId && req.body.planId !== sub.planId && sub.autopayStatus === 'ACTIVE') {
      throw Conflict('Turn off autopay before switching plans');
    }

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
    if (!price) throw BadRequest('No pricing for this plan/city/product combination');
    // Renewing the plan you are on is fine after it is switched off; moving
    // onto a switched-off plan is not.
    if (targetPlanId !== sub.planId && !price.plan.isActive) throw BadRequest('That plan is no longer available');

    // Charge the term being granted below, not one month of it.
    const amountPaise = termPricePaise(price.monthlyPricePaise, price.plan.durationMonths);

    const open = await findOpenOrder({ kind: 'RECHARGE', subscriptionId: sub.id, targetPlanId, amountPaise });
    if (open?.gatewayRef) {
      return res.status(201).json({
        data: {
          keyId: getPublicKeyId(),
          orderId: open.gatewayRef,
          amount: amountPaise,
          currency: 'INR',
          paymentId: open.id,
          planId: targetPlanId,
        },
      });
    }

    const payment = await prisma.payment.create({
      data: {
        userId: sub.userId,
        subscriptionId: sub.id,
        kind: 'RECHARGE',
        amountPaise,
        status: 'INITIATED',
        // Settlement reads this back: without it the customer pays the annual
        // price and is granted the monthly term, still on the old plan.
        targetPlanId,
      },
    });

    const order = await createOrder({
      amountPaise,
      receipt: `pay_${payment.id}`,
      notes: {
        paymentId: payment.id,
        subscriptionId: sub.id,
        planId: targetPlanId,
        kind: 'RECHARGE',
      },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { gatewayRef: order.id },
    });

    res.status(201).json({
      data: {
        keyId: getPublicKeyId(),
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        paymentId: payment.id,
        planId: targetPlanId,
      },
    });
  })
);

/**
 * How often Razorpay debits a mandate for a plan of this many calendar months,
 * and how many debits that is: about two years, or five years for yearly
 * plans. Razorpay's monthly billing lands on the same date each month, which
 * is when our plan ends (addMonthsIst). A flat 24 debits used to mean 12
 * years on a 6-month plan.
 */
export function mandateSchedule(durationMonths: number): {
  period: 'monthly' | 'yearly';
  interval: number;
  totalCount: number;
} {
  const months = Math.max(1, durationMonths);
  if (months % 12 === 0) {
    return { period: 'yearly', interval: months / 12, totalCount: Math.max(1, Math.round(60 / months)) };
  }
  return { period: 'monthly', interval: months, totalCount: Math.max(1, Math.round(24 / months)) };
}

// ─────────────────────────── Autopay (mandate) ───────────────────────────
//
// Creates a Razorpay Plan + Subscription pair. Returns a `short_url` the
// client opens to authorise the e-mandate (UPI Autopay / NACH). Once the
// customer authorises, Razorpay fires `subscription.activated` followed by
// recurring `subscription.charged` events handled by the webhook below.

router.post(
  '/subscriptions/:id/autopay',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: { booking: true, plan: true, product: true },
    });
    if (!sub || sub.userId !== req.auth!.sub) throw NotFound('Subscription not found');
    if (sub.status === 'CLOSED') throw BadRequest('This plan is closed');
    if (sub.status === 'PAUSED') throw BadRequest('Resume the plan before setting up autopay');
    if (sub.autopayStatus === 'ACTIVE') {
      return res.json({ data: { alreadyActive: true, autopayId: sub.autopayId } });
    }
    // A mandate left behind — authorisation never finished (CREATED), or a
    // paused / retrying one — would otherwise sit beside the new one, and the
    // customer could end up with two live debits. Best effort: one that is
    // already dead at Razorpay refuses the cancel, which is fine.
    if (sub.autopayId && sub.autopayStatus !== 'CANCELLED' && sub.autopayStatus !== 'COMPLETED') {
      try {
        await cancelMandate(sub.autopayId, false);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(`[autopay] could not cancel stale mandate ${sub.autopayId} for subscription ${sub.id}`, e);
      }
    }

    const price = await prisma.planCityPrice.findUnique({
      where: {
        planId_cityId_productId: {
          planId: sub.planId,
          cityId: sub.booking.cityId,
          productId: sub.productId,
        },
      },
    });
    if (!price) throw BadRequest('No pricing found for current plan/city/product');

    const { period, interval, totalCount } = mandateSchedule(sub.plan.durationMonths);
    // Each debit buys one whole term (subscription.charged extends by
    // one term), so it must cost one term — not one month's rent.
    const amountPaise = termPricePaise(price.monthlyPricePaise, sub.plan.durationMonths);

    const rzpPlan = await createMandatePlan({
      amountPaise,
      name: `${sub.product.name} — ${sub.plan.name}`,
      description: `SmartRO autopay (${sub.plan.name})`,
      period,
      interval,
    });
    // First debit on the renewal date. Without start_at Razorpay debits at
    // authorisation, so a customer with months left paid for the next term
    // straight away. A plan that has ended (or is about to) renews now.
    const startAt = sub.expiresAt.getTime() > Date.now() + 60 * 60 * 1000 ? sub.expiresAt : undefined;
    const rzpSub = await createMandateSubscription({
      planId: rzpPlan.id,
      totalCount,
      startAt,
      notes: {
        subscriptionId: sub.id,
        userId: sub.userId,
        productId: sub.productId,
      },
    });

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { autopayId: rzpSub.id, autopayStatus: 'CREATED' },
    });

    res.status(201).json({
      data: {
        keyId: getPublicKeyId(),
        autopayId: rzpSub.id,
        shortUrl: rzpSub.short_url,
        amountPaise,
        period,
        // null = the first debit happens when the customer authorises.
        firstDebitAt: startAt ? startAt.toISOString() : null,
      },
    });
  })
);

/**
 * A Razorpay call made on the customer's behalf. Gateway trouble (network,
 * a mandate in the wrong state) is a 502 the app can show, not a 500.
 */
async function viaGateway<T>(action: string, autopayId: string, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[autopay] ${action} failed for mandate ${autopayId}`, e);
    const detail = (e as { error?: { description?: string } } | null)?.error?.description;
    throw new HttpError(
      502,
      'AUTOPAY_GATEWAY_ERROR',
      `We couldn't ${action} your autopay right now.${detail ? ` ${detail.trim().replace(/\.*$/, '.')}` : ''} Please try again in a few minutes.`
    );
  }
}

router.post(
  '/subscriptions/:id/autopay/cancel',
  authRequired(['CUSTOMER']),
  validateBody(z.object({ atCycleEnd: z.boolean().default(false) }).default({})),
  asyncHandler(async (req, res) => {
    const sub = await prisma.subscription.findUnique({ where: { id: req.params.id } });
    if (!sub || sub.userId !== req.auth!.sub) throw NotFound('Subscription not found');
    if (!sub.autopayId) throw BadRequest('No autopay mandate to cancel');
    const autopayId = sub.autopayId;
    await viaGateway('turn off', autopayId, () => cancelMandate(autopayId, req.body.atCycleEnd === true));
    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: { autopayStatus: 'CANCELLED' },
    });
    res.json({ data: updated });
  })
);

router.post(
  '/subscriptions/:id/autopay/pause',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const sub = await prisma.subscription.findUnique({ where: { id: req.params.id } });
    if (!sub || sub.userId !== req.auth!.sub) throw NotFound('Subscription not found');
    if (!sub.autopayId) throw BadRequest('No autopay mandate');
    const autopayId = sub.autopayId;
    await viaGateway('pause', autopayId, () => pauseMandate(autopayId));
    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: { autopayStatus: 'PAUSED' },
    });
    res.json({ data: updated });
  })
);

router.post(
  '/subscriptions/:id/autopay/resume',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const sub = await prisma.subscription.findUnique({ where: { id: req.params.id } });
    if (!sub || sub.userId !== req.auth!.sub) throw NotFound('Subscription not found');
    if (!sub.autopayId) throw BadRequest('No autopay mandate');
    // Debits restarting on a frozen or refunded plan would charge for
    // service the customer isn't getting.
    if (sub.status === 'CLOSED') throw BadRequest('This plan is closed');
    if (sub.status === 'PAUSED') throw BadRequest('Resume the plan before resuming autopay');
    const autopayId = sub.autopayId;
    await viaGateway('resume', autopayId, () => resumeMandate(autopayId));
    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: { autopayStatus: 'ACTIVE' },
    });
    res.json({ data: updated });
  })
);

// ─────────────────────────── Verify client callback ───────────────────────────

const verifyBody = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});

router.post(
  '/verify',
  authRequired(['CUSTOMER']),
  validateBody(verifyBody),
  asyncHandler(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as z.infer<
      typeof verifyBody
    >;

    const ok = verifyCheckoutSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });
    if (!ok) throw new HttpError(400, 'BAD_SIGNATURE', 'Invalid payment signature');

    const payment = await prisma.payment.findFirst({
      where: { gatewayRef: razorpay_order_id, userId: req.auth!.sub },
    });
    if (!payment) throw NotFound('Payment not found for this order');

    const result = await settlePayment(payment.id, razorpay_payment_id);
    res.json({ data: result });
  })
);

// ─────────────────────────── Sync an order from Razorpay ───────────────────────────
//
// For when the app holds no signed result to verify: the SDK reported a
// cancel for a payment that went through, or /verify kept failing. Asks
// Razorpay directly, so it works without a reachable webhook (local dev).

router.post(
  '/orders/:orderId/sync',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const payment = await prisma.payment.findFirst({
      where: { gatewayRef: req.params.orderId, userId: req.auth!.sub },
    });
    if (!payment) throw NotFound('Payment not found for this order');

    if (payment.status !== 'SUCCESS') {
      const captured = (await fetchOrderPayments(req.params.orderId)).find(
        (p) => p.status === 'captured' && p.amount === payment.amountPaise
      );
      if (captured) await settlePayment(payment.id, captured.id);
    }

    const now = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    res.json({ data: { status: now.status, settled: now.status === 'SUCCESS' } });
  })
);

// ─────────────────────────── Webhook handler ───────────────────────────
//
// Mounted on the v1 router as /webhooks/razorpay. The raw body (preserved by
// the json `verify` hook in app.ts) is required for signature verification.

export const webhookRouter = Router();

webhookRouter.post(
  '/',
  asyncHandler(async (req: Request, res) => {
    const sig = req.header('x-razorpay-signature');
    const raw = (req as Request & { rawBody?: string }).rawBody;
    if (!sig || !raw) throw new HttpError(400, 'BAD_SIGNATURE', 'Missing signature or body');
    if (!verifyWebhookSignature(raw, sig)) {
      throw new HttpError(400, 'BAD_SIGNATURE', 'Invalid webhook signature');
    }

    const event = req.body as {
      event: string;
      payload: {
        payment?: { entity: { id: string; order_id: string; status: string; amount?: number; notes?: Record<string, string> } };
        subscription?: { entity: { id: string; status: string; notes?: Record<string, string> } };
        refund?: { entity: { id: string; payment_id: string; amount: number; status: string } };
      };
    };

    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const p = event.payload?.payment?.entity;
      if (!p) return res.json({ data: { ok: true, ignored: true } });
      // Razorpay sends order_id: null for payments made outside an Order
      // (payment links, QR, dashboard captures). Prisma reads a null filter as
      // IS NULL, which matches any payment whose order id we never stored —
      // settling a stranger's booking from an unrelated payment.
      if (!p.order_id) return res.json({ data: { ok: true, ignored: true, reason: 'no order' } });
      const payment = await prisma.payment.findFirst({ where: { gatewayRef: p.order_id } });
      if (!payment) return res.json({ data: { ok: true, ignored: true, reason: 'unknown order' } });
      if (payment.status === 'SUCCESS') return res.json({ data: { ok: true, alreadyApplied: true } });
      if (typeof p.amount === 'number' && p.amount !== payment.amountPaise) {
        // eslint-disable-next-line no-console
        console.error(`[webhook] amount mismatch on ${p.order_id}: charged ${p.amount}, expected ${payment.amountPaise}`);
        return res.json({ data: { ok: true, ignored: true, reason: 'amount mismatch' } });
      }
      await settlePayment(payment.id, p.id);
      return res.json({ data: { ok: true } });
    }

    if (event.event === 'payment.failed') {
      const p = event.payload?.payment?.entity;
      if (!p || !p.order_id) return res.json({ data: { ok: true, ignored: true } });
      const payment = await prisma.payment.findFirst({ where: { gatewayRef: p.order_id } });
      if (payment && payment.status === 'INITIATED') {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
      }
      return res.json({ data: { ok: true } });
    }

    // ── Subscription/Mandate lifecycle ────────────────────────
    if (event.event === 'subscription.activated' || event.event === 'subscription.authenticated') {
      const s = event.payload?.subscription?.entity;
      if (!s) return res.json({ data: { ok: true, ignored: true } });
      const sub = await prisma.subscription.findFirst({ where: { autopayId: s.id } });
      if (!sub) return res.json({ data: { ok: true } });
      // Authorised after the plan was cancelled and refunded: a live mandate
      // would start debiting a customer who has no plan. Kill it.
      if (sub.status === 'CLOSED') {
        let cancelled = false;
        try {
          await cancelMandate(s.id, false);
          cancelled = true;
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(`[webhook] could not cancel mandate ${s.id} on CLOSED subscription ${sub.id}`, e);
        }
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { autopayStatus: cancelled ? 'CANCELLED' : 'CANCEL_FAILED' },
        });
        return res.json({ data: { ok: true, ignored: true, reason: 'plan closed' } });
      }
      // authenticated and activated both arrive for one mandate (and either
      // may be redelivered): tell the customer once.
      if (sub.autopayStatus !== 'ACTIVE') {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { autopayStatus: 'ACTIVE' },
        });
        await prisma.notification.create({
          data: {
            userId: sub.userId,
            channel: 'INAPP',
            title: 'Autopay activated',
            body: 'Your plan will now renew automatically. Each renewal is debited on the day it is due.',
          },
        });
      }
      return res.json({ data: { ok: true } });
    }

    const MANDATE_STATUS: Record<string, string> = {
      'subscription.cancelled': 'CANCELLED',
      'subscription.halted': 'HALTED',
      'subscription.paused': 'PAUSED',
      // A debit failed and Razorpay is retrying it.
      'subscription.pending': 'PENDING',
      // Every debit in total_count has been made; nothing more will be taken.
      'subscription.completed': 'COMPLETED',
      'subscription.resumed': 'ACTIVE',
    };
    if (event.event in MANDATE_STATUS) {
      const s = event.payload?.subscription?.entity;
      if (!s) return res.json({ data: { ok: true, ignored: true } });
      const sub = await prisma.subscription.findFirst({ where: { autopayId: s.id } });
      const status = MANDATE_STATUS[event.event]!;
      // Never mark a closed plan's mandate live again.
      if (sub && !(status === 'ACTIVE' && sub.status === 'CLOSED')) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { autopayStatus: status },
        });
      }
      return res.json({ data: { ok: true } });
    }

    if (event.event === 'subscription.charged') {
      // Razorpay fires both `payment.captured` and `subscription.charged` for
      // mandate debits. We treat the payment side as the source of truth and
      // just stamp the subscription with the recurring debit.
      const p = event.payload?.payment?.entity;
      const s = event.payload?.subscription?.entity;
      if (!p || !s) return res.json({ data: { ok: true, ignored: true } });
      const sub = await prisma.subscription.findFirst({
        where: { autopayId: s.id },
        include: { plan: true },
      });
      if (!sub) return res.json({ data: { ok: true, ignored: true } });

      // Razorpay redelivers a webhook until it gets a 2xx, and retries after
      // timeouts it already delivered. Without this the plan is extended twice
      // and the customer is invoiced twice for one debit.
      const gatewayRef = `${s.id}:${p.id}`;
      const already = await prisma.payment.findFirst({ where: { gatewayRef } });
      if (already) return res.json({ data: { ok: true, alreadyApplied: true } });
      const amountPaise = p.amount ?? 0;

      // A cancelled plan must never be revived by a late mandate debit: the
      // customer has already been refunded and their device collected. Keep
      // the money on record and owe it back, as settlePayment does.
      if (sub.status === 'CLOSED') {
        await prisma.$transaction(async (tx) => {
          await tx.payment.create({
            data: {
              userId: sub.userId,
              subscriptionId: sub.id,
              kind: 'RECHARGE',
              amountPaise,
              status: 'SUCCESS',
              gatewayRef,
              gatewayPaymentId: p.id,
            },
          });
          await queueRefund(tx, {
            userId: sub.userId,
            bookingId: null,
            subscriptionId: sub.id,
            amountPaise,
            gatewayPaymentId: p.id,
          });
        });
        // eslint-disable-next-line no-console
        console.error(`[webhook] mandate ${s.id} charged CLOSED subscription ${sub.id}; refund queued for ${p.id}`);
        // The mandate should already be dead; stop the next debit if it isn't.
        try {
          await cancelMandate(s.id, false);
          await prisma.subscription.update({ where: { id: sub.id }, data: { autopayStatus: 'CANCELLED' } });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error(`[webhook] could not cancel mandate ${s.id} on CLOSED subscription ${sub.id}`, e);
        }
        return res.json({ data: { ok: true, refundQueued: true } });
      }

      // Create a RECHARGE payment row + extend expiresAt the same way the
      // manual recharge path does. A paused plan gets the term but stays paused.
      const { expiresAt: newExpiresAt, status } = applyPaidTerm(sub, sub.plan.durationMonths);
      await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            userId: sub.userId,
            subscriptionId: sub.id,
            kind: 'RECHARGE',
            amountPaise,
            status: 'SUCCESS',
            gatewayRef,
            gatewayPaymentId: p.id,
          },
        });
        await tx.invoice.create({
          data: {
            paymentId: payment.id,
            number: await nextInvoiceNumber(tx),
            amountPaise,
            gstPaise: Math.round(amountPaise * 0.18),
          },
        });
        await tx.subscription.update({
          where: { id: sub.id },
          data: { expiresAt: newExpiresAt, status },
        });
        const rupees = Math.round(amountPaise / 100);
        await tx.notification.create({
          data: {
            userId: sub.userId,
            channel: 'INAPP',
            title: 'Autopay charged',
            body:
              status === 'PAUSED'
                ? `Recharged ₹${rupees} via autopay. Your plan is still paused; the new term is added and its clock restarts when you resume.`
                : `Recharged ₹${rupees} via autopay. Active until ${formatIstDate(newExpiresAt)}.`,
          },
        });
      });
      return res.json({ data: { ok: true } });
    }

    // ── Refunds ──────────────────────────────────────────────
    if (event.event === 'refund.processed' || event.event === 'refund.created') {
      const r = event.payload?.refund?.entity;
      if (!r || !r.payment_id) return res.json({ data: { ok: true, ignored: true } });
      // Money is only back with the customer once the refund is processed;
      // refund.created just means it was queued at the gateway.
      if (event.event === 'refund.created') {
        return res.json({ data: { ok: true, ignored: true, reason: 'not processed yet' } });
      }
      // Match on the payment being refunded, which cancel stores on the refund
      // row. The old lookup searched gatewayRef for the Razorpay payment id,
      // but that column holds "REFUND_PENDING_<timestamp>" — it never matched,
      // so every refund sat INITIATED forever.
      const refund = await prisma.payment.findFirst({
        where: { kind: 'REFUND', status: 'INITIATED', gatewayPaymentId: r.payment_id },
        orderBy: { createdAt: 'asc' },
      });
      if (!refund) {
        // eslint-disable-next-line no-console
        console.warn(`[webhook] refund ${r.id} for payment ${r.payment_id} matched no queued refund`);
        return res.json({ data: { ok: true, ignored: true, reason: 'no queued refund' } });
      }
      if (typeof r.amount === 'number' && r.amount !== refund.amountPaise) {
        // eslint-disable-next-line no-console
        console.error(`[webhook] refund ${r.id} amount ${r.amount} != queued ${refund.amountPaise}`);
      }
      await prisma.payment.update({
        where: { id: refund.id },
        data: { status: 'SUCCESS', gatewayRef: r.id },
      });
      return res.json({ data: { ok: true } });
    }

    // Anything else: acknowledge so Razorpay doesn't retry.
    res.json({ data: { ok: true, ignored: true, event: event.event } });
  })
);

/**
 * Money arrived that can't be applied to a plan: owe it back and tell the
 * customer. Same shape as cancellation refunds — issued from the Razorpay
 * Dashboard, settled by the refund.processed webhook, which finds the row by
 * the gateway payment it reverses.
 */
async function queueRefund(
  tx: Prisma.TransactionClient,
  args: {
    userId: string;
    bookingId: string | null;
    subscriptionId: string | null;
    amountPaise: number;
    gatewayPaymentId: string;
  }
) {
  await tx.payment.create({
    data: {
      userId: args.userId,
      bookingId: args.bookingId,
      subscriptionId: args.subscriptionId,
      kind: 'REFUND',
      amountPaise: args.amountPaise,
      status: 'INITIATED',
      gatewayRef: `REFUND_PENDING_${Date.now()}`,
      gatewayPaymentId: args.gatewayPaymentId,
    },
  });
  await tx.notification.create({
    data: {
      userId: args.userId,
      channel: 'INAPP',
      title: 'Refund on the way',
      body: `We received ₹${Math.round(args.amountPaise / 100)} that we could not apply to your plan. It will be refunded to your original payment method.`,
    },
  });
}

// ─────────────────────────── Internal: post-success state machine ───────────────────────────
//
// Idempotent: returns the existing state if the payment is already SUCCESS.
// Handles both DEPOSIT (booking → INSTALLED + create subscription) and
// RECHARGE (extend subscription.expiresAt) kinds.

async function settlePayment(paymentId: string, gatewayPaymentId: string) {
  const result = await prisma.$transaction(async (tx) => {
    // Claim the row atomically. The checkout callback (/verify) and the
    // payment.captured webhook usually land seconds apart; with a plain
    // read-then-write both saw INITIATED, and the loser hit a unique
    // constraint and answered 500 for a payment that had gone through.
    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: { not: 'SUCCESS' } },
      // gatewayRef keeps holding the order id — both /payments/verify and the
      // webhook find the row by it.
      data: { status: 'SUCCESS', gatewayPaymentId },
    });
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { booking: { include: { plan: true } }, subscription: true },
    });
    if (!payment) throw NotFound('Payment not found');
    if (claimed.count === 0) return { payment, alreadyApplied: true };
    const updatedPay = payment;

    // Money arrived for something that can no longer take it: a second order
    // paid for one booking, a booking cancelled meanwhile, or a plan closed
    // after the order was made. Creating the subscription again used to hit a
    // unique constraint, roll back, and answer 500 with the money kept and no
    // record that a refund was owed.
    const b0 = payment.booking;
    const unappliable =
      (payment.kind === 'DEPOSIT' &&
        b0 &&
        (['PAID', 'INSTALLED', 'CANCELLED'].includes(b0.status) ||
          (await tx.subscription.findUnique({ where: { bookingId: b0.id } })) !== null)) ||
      (payment.kind === 'RECHARGE' && payment.subscription?.status === 'CLOSED');
    if (unappliable) {
      await queueRefund(tx, {
        userId: payment.userId,
        bookingId: payment.bookingId,
        subscriptionId: payment.subscriptionId,
        amountPaise: payment.amountPaise,
        gatewayPaymentId,
      });
      // eslint-disable-next-line no-console
      console.error(`[payments] ${gatewayPaymentId} for payment ${payment.id} could not be applied; refund queued`);
      return { payment: updatedPay, refundQueued: true };
    }

    await tx.invoice.create({
      data: {
        paymentId: payment.id,
        number: await nextInvoiceNumber(tx),
        amountPaise: payment.amountPaise,
        gstPaise: Math.round(payment.amountPaise * 0.18),
      },
    });

    if (payment.kind === 'DEPOSIT' && payment.booking) {
      const b = payment.booking;
      const { startedAt, expiresAt, lockInUntil, trialEndsAt } = firstTermDates(new Date(), b.plan.durationMonths);
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
      // Same as the stub /bookings/:id/pay. Left at PENDING_PAY, the order
      // route kept accepting new orders, so one booking could be paid twice.
      await tx.booking.update({ where: { id: b.id }, data: { status: 'PAID' } });
      // Paid, not installed — the technician's INSTALL job sets INSTALLED, and
      // the install-slot screen refuses a booking that is already INSTALLED.
      await tx.notification.create({
        data: {
          userId: b.userId,
          channel: 'INAPP',
          title: 'Payment received',
          body: `Your subscription is now active until ${formatIstDate(expiresAt)}.`,
        },
      });
      return { payment: updatedPay, subscription: sub };
    }

    if (payment.kind === 'RECHARGE' && payment.subscription) {
      const sub = payment.subscription;
      // The customer may have paid to switch plans. Grant the term they were
      // charged for, and actually move them onto it.
      const planId = payment.targetPlanId ?? sub.planId;
      const plan = await tx.plan.findUnique({ where: { id: planId } });
      if (!plan) throw NotFound('Plan not found');
      // Paused after the order was made: grant the term, stay paused.
      const { expiresAt: newExpiresAt, status } = applyPaidTerm(sub, plan.durationMonths);
      const updatedSub = await tx.subscription.update({
        where: { id: sub.id },
        data: { expiresAt: newExpiresAt, status, planId },
      });
      await tx.notification.create({
        data: {
          userId: sub.userId,
          channel: 'INAPP',
          title: 'Recharge successful',
          body:
            status === 'PAUSED'
              ? 'Your recharge is added. Your plan is still paused; its clock restarts when you resume.'
              : `Your plan is extended to ${formatIstDate(newExpiresAt)}.`,
        },
      });
      return { payment: updatedPay, subscription: updatedSub };
    }

    return { payment: updatedPay };
  });

  // Post-commit: credit the referrer on the customer's first paid booking.
  // Best-effort — never block payment success on a referral side-effect.
  // Only the call that actually settled it: /verify and the webhook both land
  // here, and the reward check (first PAID booking) is true for each of them.
  if ('subscription' in result && result.payment.kind === 'DEPOSIT') {
    try {
      await applyReferralRewardOnFirstPayment(result.payment.userId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[referral] reward credit failed', e);
    }
  }

  return result;
}

export default router;
