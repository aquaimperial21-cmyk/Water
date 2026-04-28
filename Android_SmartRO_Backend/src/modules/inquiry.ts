import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../core/prisma';
import { authOptional, authRequired } from '../core/auth';
import { NotFound, asyncHandler } from '../core/errors';
import { validateBody, validateQuery } from '../core/validate';

const router = Router();

const createInquirySchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().regex(/^\+?\d{10,15}$/),
  pincode: z.string().regex(/^\d{6}$/),
  cityId: z.string().optional(),
  productId: z.string().optional(),
  planId: z.string().optional(),
  preferredSlot: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

router.post(
  '/',
  authOptional(),
  validateBody(createInquirySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createInquirySchema>;
    const inquiry = await prisma.inquiry.create({
      data: {
        userId: req.auth?.sub,
        name: body.name,
        phone: body.phone,
        pincode: body.pincode,
        cityId: body.cityId,
        productId: body.productId,
        planId: body.planId,
        preferredSlot: body.preferredSlot,
        notes: body.notes,
        events: {
          create: {
            actorUserId: req.auth?.sub,
            type: 'STATUS_CHANGE',
            payload: JSON.stringify({ to: 'NEW' }),
          },
        },
      },
    });
    res.status(201).json({ data: inquiry });
  })
);

router.get(
  '/me',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const items = await prisma.inquiry.findMany({
      where: { userId: req.auth!.sub },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: items });
  })
);

// Admin endpoints
router.get(
  '/',
  authRequired(['ADMIN']),
  validateQuery(
    z.object({
      status: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      perPage: z.coerce.number().int().min(1).max(100).default(20),
    })
  ),
  asyncHandler(async (req, res) => {
    const { status, page, perPage } = req.query as unknown as { status?: string; page: number; perPage: number };
    const where = status ? { status } : {};
    const [total, items] = await Promise.all([
      prisma.inquiry.count({ where }),
      prisma.inquiry.findMany({
        where,
        include: { city: true, user: { select: { id: true, fullName: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
    ]);
    res.json({ data: items, meta: { total, page, perPage } });
  })
);

router.patch(
  '/:id/status',
  authRequired(['ADMIN']),
  validateBody(
    z.object({
      status: z.enum(['NEW', 'CONTACTED', 'PROPOSAL_SENT', 'BOOKED', 'LOST']),
      note: z.string().max(500).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const inq = await prisma.inquiry.findUnique({ where: { id: req.params.id } });
    if (!inq) throw NotFound('Inquiry not found');
    const updated = await prisma.inquiry.update({
      where: { id: req.params.id },
      data: {
        status: req.body.status,
        events: {
          create: {
            actorUserId: req.auth!.sub,
            type: 'STATUS_CHANGE',
            payload: JSON.stringify({ from: inq.status, to: req.body.status, note: req.body.note }),
          },
        },
      },
    });
    res.json({ data: updated });
  })
);

router.get(
  '/:id',
  authRequired(['ADMIN']),
  asyncHandler(async (req, res) => {
    const inq = await prisma.inquiry.findUnique({
      where: { id: req.params.id },
      include: { events: { orderBy: { createdAt: 'desc' } }, city: true, user: true },
    });
    if (!inq) throw NotFound('Inquiry not found');
    res.json({ data: inq });
  })
);

export default router;
