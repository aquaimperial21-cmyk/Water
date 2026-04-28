import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../core/prisma';
import { authRequired } from '../core/auth';
import { Forbidden, NotFound, asyncHandler } from '../core/errors';
import { validateBody } from '../core/validate';

const router = Router();

router.get(
  '/me',
  authRequired(['TECHNICIAN']),
  asyncHandler(async (req, res) => {
    const tech = await prisma.technician.findUnique({
      where: { userId: req.auth!.sub },
      include: { user: { select: { id: true, fullName: true, phone: true, email: true } } },
    });
    if (!tech) throw NotFound('Technician profile not found');
    res.json({ data: tech });
  })
);

router.get(
  '/jobs/today',
  authRequired(['TECHNICIAN']),
  asyncHandler(async (req, res) => {
    const tech = await prisma.technician.findUnique({ where: { userId: req.auth!.sub } });
    if (!tech) throw NotFound('Technician profile not found');
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(start.getDate() + 1);
    const jobs = await prisma.job.findMany({
      where: { technicianId: tech.id, scheduledFor: { gte: start, lt: end } },
      include: {
        ticket: {
          include: { user: { select: { id: true, fullName: true, phone: true } }, device: true },
        },
      },
      orderBy: { scheduledFor: 'asc' },
    });
    res.json({ data: jobs });
  })
);

router.get(
  '/jobs',
  authRequired(['TECHNICIAN']),
  asyncHandler(async (req, res) => {
    const tech = await prisma.technician.findUnique({ where: { userId: req.auth!.sub } });
    if (!tech) throw NotFound('Technician profile not found');
    const jobs = await prisma.job.findMany({
      where: { technicianId: tech.id },
      include: {
        ticket: {
          include: { user: { select: { id: true, fullName: true, phone: true } }, device: true },
        },
      },
      orderBy: { scheduledFor: 'desc' },
    });
    res.json({ data: jobs });
  })
);

router.get(
  '/jobs/:id',
  authRequired(['TECHNICIAN']),
  asyncHandler(async (req, res) => {
    const tech = await prisma.technician.findUnique({ where: { userId: req.auth!.sub } });
    if (!tech) throw NotFound('Technician profile not found');
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        ticket: {
          include: { user: { select: { id: true, fullName: true, phone: true } }, device: true },
        },
      },
    });
    if (!job) throw NotFound('Job not found');
    if (job.technicianId !== tech.id) throw Forbidden('Not your job');
    res.json({ data: job });
  })
);

router.patch(
  '/jobs/:id/status',
  authRequired(['TECHNICIAN']),
  validateBody(
    z.object({
      status: z.enum(['SCHEDULED', 'EN_ROUTE', 'IN_PROGRESS', 'DONE', 'CANCELLED']),
      notes: z.string().max(2000).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const tech = await prisma.technician.findUnique({ where: { userId: req.auth!.sub } });
    if (!tech) throw NotFound('Technician profile not found');
    const job = await prisma.job.findUnique({ where: { id: req.params.id }, include: { ticket: true } });
    if (!job) throw NotFound('Job not found');
    if (job.technicianId !== tech.id) throw Forbidden('Not your job');

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: req.body.status,
        notes: req.body.notes,
        completedAt: req.body.status === 'DONE' ? new Date() : null,
      },
    });

    if (job.ticket) {
      const ticketStatus =
        req.body.status === 'IN_PROGRESS' ? 'IN_PROGRESS' :
        req.body.status === 'DONE' ? 'RESOLVED' :
        req.body.status === 'EN_ROUTE' ? 'IN_PROGRESS' :
        job.ticket.status;
      if (ticketStatus !== job.ticket.status) {
        await prisma.ticket.update({ where: { id: job.ticket.id }, data: { status: ticketStatus } });
      }
    }

    res.json({ data: updated });
  })
);

// Admin: list all technicians
router.get(
  '/',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const list = await prisma.technician.findMany({
      include: { user: { select: { id: true, fullName: true, phone: true, email: true } } },
      orderBy: { employeeCode: 'asc' },
    });
    res.json({ data: list });
  })
);

export default router;
