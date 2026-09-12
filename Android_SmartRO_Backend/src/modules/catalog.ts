import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../core/prisma';
import { NotFound, asyncHandler } from '../core/errors';
import { validateQuery } from '../core/validate';

const router = Router();

router.get(
  '/cities',
  validateQuery(z.object({ includeAll: z.enum(['true', 'false']).optional() })),
  asyncHandler(async (req, res) => {
    const includeAll = req.query.includeAll === 'true';
    const cities = await prisma.city.findMany({
      where: includeAll ? {} : { isServiceable: true },
      orderBy: { name: 'asc' },
    });
    res.json({ data: cities });
  })
);

router.get(
  '/products',
  validateQuery(
    z.object({
      cityId: z.string().optional(),
      kind: z.enum(['HOME', 'COMMERCIAL']).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const { cityId, kind } = req.query as { cityId?: string; kind?: 'HOME' | 'COMMERCIAL' };
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(kind ? { kind } : {}),
        ...(cityId ? { prices: { some: { cityId } } } : {}),
      },
      include: cityId
        ? {
            prices: {
              where: { cityId },
              include: { plan: true },
              orderBy: { plan: { durationDays: 'asc' } },
            },
          }
        : { prices: { include: { plan: true, city: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ data: products });
  })
);

router.get(
  '/products/:slug',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { slug: req.params.slug },
      include: { prices: { include: { plan: true, city: true } } },
    });
    if (!product) throw NotFound('Product not found');
    res.json({ data: product });
  })
);

router.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { durationDays: 'asc' },
    });
    res.json({ data: plans });
  })
);

router.get(
  '/pricing',
  validateQuery(z.object({ productId: z.string(), cityId: z.string() })),
  asyncHandler(async (req, res) => {
    const { productId, cityId } = req.query as { productId: string; cityId: string };
    const prices = await prisma.planCityPrice.findMany({
      where: { productId, cityId },
      include: { plan: true },
      orderBy: { plan: { durationDays: 'asc' } },
    });
    res.json({ data: prices });
  })
);

// Recompute Product.lowestMonthlyPaise — cheapest active monthly across all
// (city, plan) tuples. Called after any price upsert in admin.ts; also exposed
// directly so seed-data scripts can prime the rollups.
export async function refreshLowestMonthlyRollup(productId?: string) {
  const productIds = productId
    ? [productId]
    : (await prisma.product.findMany({ select: { id: true } })).map((p) => p.id);
  for (const id of productIds) {
    const min = await prisma.planCityPrice.aggregate({
      where: { productId: id },
      _min: { monthlyPricePaise: true },
    });
    await prisma.product.update({
      where: { id },
      data: { lowestMonthlyPaise: min._min.monthlyPricePaise ?? null },
    });
  }
  return productIds.length;
}

export default router;
