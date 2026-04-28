import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../core/prisma';
import { authRequired } from '../core/auth';
import { BadRequest, NotFound, asyncHandler } from '../core/errors';
import { validateBody } from '../core/validate';

const router = Router();

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
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: { plan: true, booking: true },
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
      include: { plan: true },
    });
    if (!price) throw BadRequest('No pricing found for this plan/city/product combination');

    const payment = await prisma.payment.create({
      data: {
        userId: sub.userId,
        subscriptionId: sub.id,
        kind: 'RECHARGE',
        amountPaise: price.monthlyPricePaise,
        status: 'INITIATED',
        gatewayRef: `STUB_${Date.now()}`,
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
          number: `SMR-${Date.now()}`,
          amountPaise: price.monthlyPricePaise,
          gstPaise: Math.round(price.monthlyPricePaise * 0.18),
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

export default router;
