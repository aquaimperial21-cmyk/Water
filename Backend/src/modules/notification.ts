// Customer notification inbox endpoints.

import { Router } from 'express';
import { prisma } from '../core/prisma';
import { authRequired } from '../core/auth';
import { asyncHandler, NotFound } from '../core/errors';

const router = Router();

router.get(
  '/me',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const items = await prisma.notification.findMany({
      where: { userId: req.auth!.sub },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const unreadCount = items.filter((n) => !n.readAt).length;
    res.json({ data: { items, unreadCount } });
  })
);

router.post(
  '/:id/read',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const n = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!n || n.userId !== req.auth!.sub) throw NotFound('Notification not found');
    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { readAt: new Date(), status: 'READ' },
    });
    res.json({ data: updated });
  })
);

router.post(
  '/read-all',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const r = await prisma.notification.updateMany({
      where: { userId: req.auth!.sub, readAt: null },
      data: { readAt: new Date(), status: 'READ' },
    });
    res.json({ data: { updated: r.count } });
  })
);

export default router;
