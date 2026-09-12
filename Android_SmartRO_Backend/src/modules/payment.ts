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
import { BadRequest, NotFound, asyncHandler, HttpError } from '../core/errors';
import { validateBody } from '../core/validate';
import { applyReferralRewardOnFirstPayment } from './referral';
import {
  cancelMandate,
  createMandatePlan,
  createMandateSubscription,
  createOrder,
  getPublicKeyId,
  pauseMandate,
  resumeMandate,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from '../services/razorpay';

const router = Router();

let invoiceCounter = Date.now() % 100000;
function nextInvoiceNumber(): string {
  invoiceCounter += 1;
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');
  return `SMR-${yyyymm}-${String(invoiceCounter).padStart(6, '0')}`;
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

    const amountPaise = booking.depositPaise + booking.firstPaymentPaise;

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

    const targetPlanId = req.body.planId ?? sub.planId;
    const price = await prisma.planCityPrice.findUnique({
      where: {
        planId_cityId_productId: {
          planId: targetPlanId,
          cityId: sub.booking.cityId,
          productId: sub.productId,
        },
      },
    });
    if (!price) throw BadRequest('No pricing for this plan/city/product combination');

    const payment = await prisma.payment.create({
      data: {
        userId: sub.userId,
        subscriptionId: sub.id,
        kind: 'RECHARGE',
        amountPaise: price.monthlyPricePaise,
        status: 'INITIATED',
      },
    });

    const order = await createOrder({
      amountPaise: price.monthlyPricePaise,
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
    if (sub.autopayStatus === 'ACTIVE') {
      return res.json({ data: { alreadyActive: true, autopayId: sub.autopayId } });
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

    // Razorpay Plan period maps roughly to our durationDays.
    const period: 'monthly' | 'yearly' =
      sub.plan.durationDays >= 365 ? 'yearly' : 'monthly';
    const intervalMonths = period === 'monthly' ? Math.max(1, Math.round(sub.plan.durationDays / 30)) : 1;
    const totalCount = period === 'monthly' ? 24 : 5; // 2 years of monthly debits, or 5 yearly

    const rzpPlan = await createMandatePlan({
      amountPaise: price.monthlyPricePaise,
      name: `${sub.product.name} — ${sub.plan.name}`,
      description: `SmartRO autopay (${sub.plan.name})`,
      period,
      interval: intervalMonths,
    });
    const rzpSub = await createMandateSubscription({
      planId: rzpPlan.id,
      totalCount,
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
        amountPaise: price.monthlyPricePaise,
        period,
      },
    });
  })
);

router.post(
  '/subscriptions/:id/autopay/cancel',
  authRequired(['CUSTOMER']),
  validateBody(z.object({ atCycleEnd: z.boolean().default(false) }).default({})),
  asyncHandler(async (req, res) => {
    const sub = await prisma.subscription.findUnique({ where: { id: req.params.id } });
    if (!sub || sub.userId !== req.auth!.sub) throw NotFound('Subscription not found');
    if (!sub.autopayId) throw BadRequest('No autopay mandate to cancel');
    await cancelMandate(sub.autopayId, req.body.atCycleEnd === true);
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
    await pauseMandate(sub.autopayId);
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
    await resumeMandate(sub.autopayId);
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
      const payment = await prisma.payment.findFirst({ where: { gatewayRef: p.order_id } });
      if (!payment) return res.json({ data: { ok: true, ignored: true, reason: 'unknown order' } });
      if (payment.status === 'SUCCESS') return res.json({ data: { ok: true, alreadyApplied: true } });
      await settlePayment(payment.id, p.id);
      return res.json({ data: { ok: true } });
    }

    if (event.event === 'payment.failed') {
      const p = event.payload?.payment?.entity;
      if (!p) return res.json({ data: { ok: true, ignored: true } });
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
      if (sub) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { autopayStatus: 'ACTIVE' },
        });
        await prisma.notification.create({
          data: {
            userId: sub.userId,
            channel: 'INAPP',
            title: 'Autopay activated',
            body: 'Your monthly recharge will now be auto-debited.',
          },
        });
      }
      return res.json({ data: { ok: true } });
    }

    if (event.event === 'subscription.cancelled' || event.event === 'subscription.halted' || event.event === 'subscription.paused') {
      const s = event.payload?.subscription?.entity;
      if (!s) return res.json({ data: { ok: true, ignored: true } });
      const sub = await prisma.subscription.findFirst({ where: { autopayId: s.id } });
      if (sub) {
        const status = event.event === 'subscription.paused' ? 'PAUSED' : event.event === 'subscription.halted' ? 'HALTED' : 'CANCELLED';
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

      // Create a RECHARGE payment row + extend expiresAt the same way the
      // manual recharge path does.
      const payment = await prisma.payment.create({
        data: {
          userId: sub.userId,
          subscriptionId: sub.id,
          kind: 'RECHARGE',
          amountPaise: p.amount ?? 0,
          status: 'SUCCESS',
          gatewayRef: `${s.id}:${p.id}`,
        },
      });
      await prisma.invoice.create({
        data: {
          paymentId: payment.id,
          number: nextInvoiceNumber(),
          amountPaise: payment.amountPaise,
          gstPaise: Math.round(payment.amountPaise * 0.18),
        },
      });
      const base = sub.expiresAt > new Date() ? sub.expiresAt : new Date();
      const newExpiresAt = new Date(base.getTime() + sub.plan.durationDays * 24 * 60 * 60 * 1000);
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { expiresAt: newExpiresAt, status: 'ACTIVE' },
      });
      await prisma.notification.create({
        data: {
          userId: sub.userId,
          channel: 'INAPP',
          title: 'Autopay charged',
          body: `Recharged ₹${Math.round(payment.amountPaise / 100)} via mandate. Active until ${newExpiresAt.toDateString()}.`,
        },
      });
      return res.json({ data: { ok: true } });
    }

    // ── Refunds ──────────────────────────────────────────────
    if (event.event === 'refund.processed' || event.event === 'refund.created') {
      const r = event.payload?.refund?.entity;
      if (!r) return res.json({ data: { ok: true, ignored: true } });
      // Mark any INITIATED refund payment as SUCCESS. Match by the linked
      // payment_id when we recorded gatewayRef = "order:payment" earlier.
      const refund = await prisma.payment.findFirst({
        where: { kind: 'REFUND', status: 'INITIATED', gatewayRef: { contains: r.payment_id } },
      });
      if (refund) {
        await prisma.payment.update({
          where: { id: refund.id },
          data: { status: 'SUCCESS', gatewayRef: `${refund.gatewayRef}:${r.id}` },
        });
      }
      return res.json({ data: { ok: true } });
    }

    // Anything else: acknowledge so Razorpay doesn't retry.
    res.json({ data: { ok: true, ignored: true, event: event.event } });
  })
);

// ─────────────────────────── Internal: post-success state machine ───────────────────────────
//
// Idempotent: returns the existing state if the payment is already SUCCESS.
// Handles both DEPOSIT (booking → INSTALLED + create subscription) and
// RECHARGE (extend subscription.expiresAt) kinds.

async function settlePayment(paymentId: string, gatewayPaymentId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { booking: { include: { plan: true } }, subscription: true },
    });
    if (!payment) throw NotFound('Payment not found');
    if (payment.status === 'SUCCESS') return { payment, alreadyApplied: true };

    const updatedPay = await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'SUCCESS', gatewayRef: `${payment.gatewayRef}:${gatewayPaymentId}` },
    });

    await tx.invoice.create({
      data: {
        paymentId: payment.id,
        number: nextInvoiceNumber(),
        amountPaise: payment.amountPaise,
        gstPaise: Math.round(payment.amountPaise * 0.18),
      },
    });

    if (payment.kind === 'DEPOSIT' && payment.booking) {
      const b = payment.booking;
      const startedAt = new Date();
      const expiresAt = new Date(startedAt.getTime() + b.plan.durationDays * 24 * 60 * 60 * 1000);
      const lockInUntil = new Date(startedAt.getTime() + 180 * 24 * 60 * 60 * 1000);
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
    }

    if (payment.kind === 'RECHARGE' && payment.subscription) {
      const sub = payment.subscription;
      const base = sub.expiresAt > new Date() ? sub.expiresAt : new Date();
      const plan = await tx.plan.findUnique({ where: { id: sub.planId } });
      if (!plan) throw NotFound('Plan not found');
      const newExpiresAt = new Date(base.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
      const updatedSub = await tx.subscription.update({
        where: { id: sub.id },
        data: { expiresAt: newExpiresAt, status: 'ACTIVE' },
      });
      await tx.notification.create({
        data: {
          userId: sub.userId,
          channel: 'INAPP',
          title: 'Recharge successful',
          body: `Your plan is extended to ${newExpiresAt.toDateString()}.`,
        },
      });
      return { payment: updatedPay, subscription: updatedSub };
    }

    return { payment: updatedPay };
  });

  // Post-commit: credit the referrer on the customer's first paid booking.
  // Best-effort — never block payment success on a referral side-effect.
  if (result && 'payment' in result && result.payment.kind === 'DEPOSIT') {
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
