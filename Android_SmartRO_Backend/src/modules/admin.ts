import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../core/prisma';
import { authRequired } from '../core/auth';
import { asyncHandler, NotFound, BadRequest } from '../core/errors';
import { validateBody } from '../core/validate';

const router = Router();

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

router.get(
  '/dashboard/stats',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const [
      activeSubscriptions,
      newInquiriesToday,
      openInquiries,
      bookingsThisMonth,
      openTickets,
      paymentsThisMonth,
      devicesByStatus,
    ] = await Promise.all([
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.inquiry.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.inquiry.count({ where: { status: { in: ['NEW', 'CONTACTED', 'PROPOSAL_SENT'] } } }),
      prisma.booking.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.ticket.count({ where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } } }),
      prisma.payment.aggregate({
        where: { status: 'SUCCESS', createdAt: { gte: monthStart } },
        _sum: { amountPaise: true },
      }),
      prisma.device.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    res.json({
      data: {
        activeSubscriptions,
        newInquiriesToday,
        openInquiries,
        bookingsThisMonth,
        openTickets,
        revenuePaiseThisMonth: paymentsThisMonth._sum.amountPaise ?? 0,
        devices: devicesByStatus.reduce((acc: Record<string, number>, d) => {
          acc[d.status] = d._count._all;
          return acc;
        }, {}),
      },
    });
  })
);

router.get(
  '/customers',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const customers = await prisma.user.findMany({
      where: { kind: 'CUSTOMER' },
      include: {
        addresses: { include: { city: true } },
        subscriptions: { include: { product: true, plan: true } },
        kycRecords: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: customers });
  })
);

router.get(
  '/customers/:id',
  authRequired(['ADMIN']),
  asyncHandler(async (req, res) => {
    const customer = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        addresses: { include: { city: true } },
        subscriptions: { include: { product: true, plan: true, device: true } },
        kycRecords: { orderBy: { createdAt: 'desc' } },
        bookings: { include: { product: true, plan: true, payments: true } },
        tickets: { orderBy: { createdAt: 'desc' } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    res.json({ data: customer });
  })
);

router.get(
  '/devices',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const items = await prisma.device.findMany({
      include: { product: true, subscription: { include: { user: { select: { id: true, fullName: true, phone: true } } } } },
      orderBy: { serial: 'asc' },
    });
    res.json({ data: items });
  })
);

router.get(
  '/payments',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const items = await prisma.payment.findMany({
      include: { user: { select: { id: true, fullName: true, phone: true } }, invoice: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ data: items });
  })
);

router.get(
  '/audit-logs',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ data: logs });
  })
);

// ───────────────────────────────────── Catalog management ──────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
  kind: z.enum(['HOME', 'COMMERCIAL']),
  capacityLitres: z.number().int().positive().max(1000),
  technology: z.string().min(1).max(40), // e.g. RO, RO+UV, RO+UV+UF
  mounting: z.enum(['WALL', 'COUNTERTOP', 'UNDER_SINK']),
  description: z.string().min(10).max(2000),
  imageUrl: z.string().url().nullish(),
  warrantyMonths: z.number().int().min(0).max(120).default(12),
  isActive: z.boolean().default(true),
});

const productPatchSchema = productSchema.partial();

const pricingSchema = z.object({
  planId: z.string().uuid(),
  cityId: z.string().uuid(),
  monthlyPricePaise: z.number().int().nonnegative(),
  depositPaise: z.number().int().nonnegative(),
});

// List all products (incl inactive) — admin view
router.get(
  '/products',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const items = await prisma.product.findMany({
      include: {
        prices: { include: { plan: true, city: true } },
        _count: { select: { bookings: true, subscriptions: true, devices: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: items });
  })
);

// Single product (admin)
router.get(
  '/products/:id',
  authRequired(['ADMIN']),
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        prices: { include: { plan: true, city: true } },
        _count: { select: { bookings: true, subscriptions: true, devices: true } },
      },
    });
    if (!product) throw NotFound('Product not found');
    res.json({ data: product });
  })
);

// Create product
router.post(
  '/products',
  authRequired(['ADMIN']),
  validateBody(productSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof productSchema>;
    const slug = input.slug ?? slugify(input.name);
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) throw BadRequest(`Slug "${slug}" already in use`);
    const product = await prisma.product.create({
      data: {
        name: input.name,
        slug,
        kind: input.kind,
        capacityLitres: input.capacityLitres,
        technology: input.technology,
        mounting: input.mounting,
        description: input.description,
        imageUrl: input.imageUrl ?? null,
        warrantyMonths: input.warrantyMonths,
        isActive: input.isActive,
      },
      include: { prices: { include: { plan: true, city: true } } },
    });
    res.status(201).json({ data: product });
  })
);

// Update product (partial)
router.patch(
  '/products/:id',
  authRequired(['ADMIN']),
  validateBody(productPatchSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const input = req.body as z.infer<typeof productPatchSchema>;
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw NotFound('Product not found');
    if (input.slug && input.slug !== existing.slug) {
      const dup = await prisma.product.findUnique({ where: { slug: input.slug } });
      if (dup) throw BadRequest(`Slug "${input.slug}" already in use`);
    }
    const product = await prisma.product.update({
      where: { id },
      data: input,
      include: { prices: { include: { plan: true, city: true } } },
    });
    res.json({ data: product });
  })
);

// Deactivate (soft delete) — keeps history
router.delete(
  '/products/:id',
  authRequired(['ADMIN']),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw NotFound('Product not found');
    const product = await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    res.json({ data: product });
  })
);

// Upsert a price for (product, city, plan)
router.post(
  '/products/:id/pricing',
  authRequired(['ADMIN']),
  validateBody(pricingSchema),
  asyncHandler(async (req, res) => {
    const productId = req.params.id;
    const { planId, cityId, monthlyPricePaise, depositPaise } = req.body as z.infer<typeof pricingSchema>;
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw NotFound('Product not found');
    const [city, plan] = await Promise.all([
      prisma.city.findUnique({ where: { id: cityId } }),
      prisma.plan.findUnique({ where: { id: planId } }),
    ]);
    if (!city) throw BadRequest('City not found');
    if (!plan) throw BadRequest('Plan not found');
    const price = await prisma.planCityPrice.upsert({
      where: { planId_cityId_productId: { planId, cityId, productId } },
      update: { monthlyPricePaise, depositPaise, effectiveFrom: new Date() },
      create: { planId, cityId, productId, monthlyPricePaise, depositPaise },
      include: { plan: true, city: true },
    });
    res.status(201).json({ data: price });
  })
);

// Remove a price row
router.delete(
  '/products/:id/pricing/:priceId',
  authRequired(['ADMIN']),
  asyncHandler(async (req, res) => {
    const { id, priceId } = req.params;
    const price = await prisma.planCityPrice.findUnique({ where: { id: priceId } });
    if (!price || price.productId !== id) throw NotFound('Price not found');
    await prisma.planCityPrice.delete({ where: { id: priceId } });
    res.json({ data: { ok: true } });
  })
);

export default router;
