// Banners — admin CRUD + public listing.
// Public GET returns only active banners whose window includes "now". The
// audience match is resolved against the calling customer's segment when
// authenticated, else returns ALL-audience banners only.

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../core/prisma';
import { authOptional, authRequired } from '../core/auth';
import { asyncHandler, NotFound } from '../core/errors';
import { validateBody } from '../core/validate';

const router = Router();

const createSchema = z.object({
  title: z.string().min(2).max(120),
  body: z.string().max(500).nullish(),
  imageUrl: z.string().max(500).nullish(),
  ctaLabel: z.string().max(40).nullish(),
  ctaTarget: z.string().max(500).nullish(),
  audience: z.string().max(80).default('ALL'),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  priority: z.number().int().default(0),
  isActive: z.boolean().default(true),
});
const patchSchema = createSchema.partial();

// Public: active banners for the current viewer
router.get(
  '/',
  authOptional(),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const all = await prisma.banner.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    let segment: 'HOME' | 'COMMERCIAL' | null = null;
    let userCityId: string | null = null;
    let isExpiring = false;

    if (req.auth) {
      const user = await prisma.user.findUnique({
        where: { id: req.auth.sub },
        include: {
          subscriptions: { include: { product: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          addresses: { take: 1 },
        },
      });
      const sub = user?.subscriptions[0];
      if (sub) {
        segment = sub.product.kind === 'COMMERCIAL' ? 'COMMERCIAL' : 'HOME';
        const days = (new Date(sub.expiresAt).getTime() - now.getTime()) / 86400000;
        isExpiring = days <= 7 && days >= 0;
      }
      userCityId = user?.addresses[0]?.cityId ?? null;
    }

    const visible = all.filter((b) => {
      if (b.audience === 'ALL') return true;
      if (b.audience === 'HOME') return segment === 'HOME';
      if (b.audience === 'COMMERCIAL') return segment === 'COMMERCIAL';
      if (b.audience === 'EXPIRING') return isExpiring;
      if (b.audience.startsWith('CITY:')) {
        const cid = b.audience.slice(5);
        return userCityId === cid;
      }
      return false;
    });

    res.json({ data: visible });
  })
);

// Admin: list all (incl scheduled / archived)
router.get(
  '/admin/list',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const items = await prisma.banner.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ data: items });
  })
);

router.post(
  '/admin',
  authRequired(['ADMIN']),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof createSchema>;
    const banner = await prisma.banner.create({
      data: {
        title: input.title,
        body: input.body ?? null,
        imageUrl: input.imageUrl ?? null,
        ctaLabel: input.ctaLabel ?? null,
        ctaTarget: input.ctaTarget ?? null,
        audience: input.audience,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        priority: input.priority,
        isActive: input.isActive,
        createdBy: req.auth!.sub,
      },
    });
    await prisma.auditLog.create({
      data: { actorUserId: req.auth!.sub, action: 'BANNER_CREATE', entity: 'Banner', entityId: banner.id, after: JSON.stringify(input) },
    });
    res.status(201).json({ data: banner });
  })
);

router.patch(
  '/admin/:id',
  authRequired(['ADMIN']),
  validateBody(patchSchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const input = req.body as z.infer<typeof patchSchema>;
    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) throw NotFound('Banner not found');
    const updated = await prisma.banner.update({
      where: { id },
      data: {
        ...input,
        startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
        endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      },
    });
    await prisma.auditLog.create({
      data: { actorUserId: req.auth!.sub, action: 'BANNER_UPDATE', entity: 'Banner', entityId: id, after: JSON.stringify(input) },
    });
    res.json({ data: updated });
  })
);

router.delete(
  '/admin/:id',
  authRequired(['ADMIN']),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) throw NotFound('Banner not found');
    await prisma.banner.update({ where: { id }, data: { isActive: false } });
    await prisma.auditLog.create({
      data: { actorUserId: req.auth!.sub, action: 'BANNER_ARCHIVE', entity: 'Banner', entityId: id },
    });
    res.json({ data: { ok: true } });
  })
);

export default router;
