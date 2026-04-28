import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../core/prisma';
import { authRequired } from '../core/auth';
import { BadRequest, NotFound, asyncHandler } from '../core/errors';
import { validateBody } from '../core/validate';

const router = Router();

const createTicketSchema = z.object({
  subscriptionId: z.string().optional(),
  category: z.enum(['INSTALL', 'REPAIR', 'FILTER', 'PICKUP', 'OTHER']),
  description: z.string().min(5).max(2000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
});

const SLA_HOURS: Record<string, number> = {
  INSTALL: 48,
  REPAIR: 24,
  FILTER: 72,
  PICKUP: 72,
  OTHER: 72,
};

router.post(
  '/',
  authRequired(['CUSTOMER']),
  validateBody(createTicketSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createTicketSchema>;
    let deviceId: string | undefined;
    if (body.subscriptionId) {
      const sub = await prisma.subscription.findUnique({ where: { id: body.subscriptionId } });
      if (!sub || sub.userId !== req.auth!.sub) throw NotFound('Subscription not found');
      deviceId = sub.deviceId ?? undefined;
    }
    const t = await prisma.ticket.create({
      data: {
        userId: req.auth!.sub,
        subscriptionId: body.subscriptionId,
        deviceId,
        category: body.category,
        description: body.description,
        priority: body.priority,
        slaDueAt: new Date(Date.now() + SLA_HOURS[body.category] * 3600 * 1000),
      },
    });
    res.status(201).json({ data: t });
  })
);

router.get(
  '/me',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const items = await prisma.ticket.findMany({
      where: { userId: req.auth!.sub },
      include: { device: true, technician: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: items });
  })
);

router.get(
  '/:id',
  authRequired(['CUSTOMER', 'ADMIN', 'TECHNICIAN']),
  asyncHandler(async (req, res) => {
    const t = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        device: true,
        technician: { include: { user: { select: { fullName: true, phone: true } } } },
        jobs: { orderBy: { scheduledFor: 'desc' } },
      },
    });
    if (!t) throw NotFound('Ticket not found');
    if (req.auth!.kind === 'CUSTOMER' && t.userId !== req.auth!.sub) throw NotFound('Ticket not found');
    res.json({ data: t });
  })
);

// Admin list / filter
router.get(
  '/',
  authRequired(['ADMIN', 'TECHNICIAN']),
  asyncHandler(async (req, res) => {
    let where = {};
    if (req.auth!.kind === 'TECHNICIAN') {
      const tech = await prisma.technician.findUnique({ where: { userId: req.auth!.sub } });
      if (!tech) throw NotFound('Technician profile not found');
      where = { technicianId: tech.id };
    }
    const items = await prisma.ticket.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        device: true,
        technician: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: items });
  })
);

router.patch(
  '/:id',
  authRequired(['ADMIN', 'TECHNICIAN']),
  validateBody(
    z.object({
      status: z.enum(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED']).optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
      technicianId: z.string().optional(),
      scheduledFor: z.string().datetime().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const t = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!t) throw NotFound('Ticket not found');

    const dataPatch: Record<string, unknown> = {};
    if (req.body.status) dataPatch.status = req.body.status;
    if (req.body.priority) dataPatch.priority = req.body.priority;
    if (req.body.technicianId !== undefined) dataPatch.technicianId = req.body.technicianId;

    const updated = await prisma.ticket.update({ where: { id: t.id }, data: dataPatch });

    // If admin assigns a technician, auto-create a Job
    if (req.body.technicianId && req.body.scheduledFor) {
      const tech = await prisma.technician.findUnique({ where: { id: req.body.technicianId } });
      if (!tech) throw BadRequest('Technician not found');
      await prisma.job.create({
        data: {
          ticketId: t.id,
          technicianId: tech.id,
          type: t.category as 'INSTALL' | 'SERVICE' | 'FILTER' | 'PICKUP',
          scheduledFor: new Date(req.body.scheduledFor),
        },
      });
      await prisma.ticket.update({ where: { id: t.id }, data: { status: 'ASSIGNED' } });
    }

    res.json({ data: updated });
  })
);

router.post(
  '/:id/rate',
  authRequired(['CUSTOMER']),
  validateBody(z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() })),
  asyncHandler(async (req, res) => {
    const t = await prisma.ticket.findUnique({ where: { id: req.params.id } });
    if (!t || t.userId !== req.auth!.sub) throw NotFound('Ticket not found');
    if (t.status !== 'RESOLVED' && t.status !== 'CLOSED') throw BadRequest('Ticket must be resolved before rating');
    const updated = await prisma.ticket.update({
      where: { id: t.id },
      data: { rating: req.body.rating, ratingComment: req.body.comment },
    });
    res.json({ data: updated });
  })
);

export default router;
