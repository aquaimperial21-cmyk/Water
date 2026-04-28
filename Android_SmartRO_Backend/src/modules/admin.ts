import { Router } from 'express';
import { prisma } from '../core/prisma';
import { authRequired } from '../core/auth';
import { asyncHandler } from '../core/errors';

const router = Router();

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

export default router;
