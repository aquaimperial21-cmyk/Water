import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../core/prisma';
import { authRequired } from '../core/auth';
import { BadRequest, NotFound, asyncHandler } from '../core/errors';
import { validateBody } from '../core/validate';

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

    const booking = await prisma.booking.create({
      data: {
        userId: req.auth!.sub,
        productId: body.productId,
        planId: body.planId,
        cityId: body.cityId,
        addressId: body.addressId,
        depositPaise: price.depositPaise,
        firstPaymentPaise: price.monthlyPricePaise,
        installationSlot: body.installationSlot ? new Date(body.installationSlot) : undefined,
        status: 'PENDING_KYC',
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
      include: { product: true, plan: true, city: true, payments: true, subscription: true },
    });
    if (!b) throw NotFound('Booking not found');
    if (req.auth!.kind === 'CUSTOMER' && b.userId !== req.auth!.sub) throw NotFound('Booking not found');
    res.json({ data: b });
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

    res.json({ data: completed });
  })
);

export default router;
