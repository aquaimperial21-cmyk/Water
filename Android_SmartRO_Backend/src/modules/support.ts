// Customer-facing support touchpoints:
//   POST /waitlist                 → "Notify me when you launch in <city>"
//   POST /help-requests            → call-back / chat / WhatsApp / FAQ feedback
//   GET  /help-requests/me         → current user's recent asks
//   GET  /admin/help-requests      → ops triage queue (ADMIN)
//   POST /admin/help-requests/:id/handle → mark handled
//
// Inbound customer WhatsApp messages route here too — see webhook.ts.

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../core/prisma';
import { authOptional, authRequired } from '../core/auth';
import { NotFound, asyncHandler } from '../core/errors';
import { validateBody } from '../core/validate';

const router = Router();

// ─────────────────────────── Waitlist (non-serviceable cities) ───────────────────────────

const waitlistSchema = z.object({
  phone: z.string().regex(/^\+?\d{10,15}$/, 'Invalid phone'),
  cityName: z.string().min(2).max(120),
  pincode: z.string().min(3).max(10).optional(),
  productId: z.string().optional(),
});

router.post(
  '/waitlist',
  authOptional(),
  validateBody(waitlistSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof waitlistSchema>;
    // De-dupe — same phone + same city within 30 days = no new row.
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const existing = await prisma.waitlistEntry.findFirst({
      where: {
        phone: body.phone,
        cityName: { equals: body.cityName },
        createdAt: { gte: cutoff },
      },
    });
    if (existing) return res.json({ data: existing });
    const created = await prisma.waitlistEntry.create({
      data: {
        phone: body.phone,
        cityName: body.cityName,
        pincode: body.pincode,
        productId: body.productId,
        source: req.auth ? 'APP' : 'WEB',
      },
    });
    res.status(201).json({ data: created });
  })
);

router.get(
  '/admin/waitlist',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const items = await prisma.waitlistEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    // Roll up by city for the dashboard counts widget
    const byCity = items.reduce<Record<string, number>>((acc, w) => {
      acc[w.cityName] = (acc[w.cityName] ?? 0) + 1;
      return acc;
    }, {});
    res.json({ data: { items, byCity } });
  })
);

// ─────────────────────────── Help requests ───────────────────────────

const helpRequestSchema = z.object({
  channel: z.enum(['CALL', 'WHATSAPP', 'CHAT', 'FAQ']),
  topic: z.enum(['billing', 'tech', 'install', 'cancellation', 'other']).optional(),
  message: z.string().max(2000).optional(),
});

router.post(
  '/help-requests',
  authRequired(['CUSTOMER']),
  validateBody(helpRequestSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof helpRequestSchema>;
    const item = await prisma.helpRequest.create({
      data: { userId: req.auth!.sub, ...body, status: 'OPEN' },
    });
    res.status(201).json({ data: item });
  })
);

router.get(
  '/help-requests/me',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const items = await prisma.helpRequest.findMany({
      where: { userId: req.auth!.sub },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ data: items });
  })
);

router.get(
  '/admin/help-requests',
  authRequired(['ADMIN']),
  asyncHandler(async (req, res) => {
    const status = (req.query.status as string | undefined) ?? 'OPEN';
    const items = await prisma.helpRequest.findMany({
      where: { status },
      include: { user: { select: { id: true, fullName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ data: items });
  })
);

router.post(
  '/admin/help-requests/:id/handle',
  authRequired(['ADMIN']),
  validateBody(z.object({ status: z.enum(['HANDLED', 'CLOSED']).default('HANDLED') }).default({})),
  asyncHandler(async (req, res) => {
    const item = await prisma.helpRequest.findUnique({ where: { id: req.params.id } });
    if (!item) throw NotFound('Help request not found');
    const updated = await prisma.helpRequest.update({
      where: { id: item.id },
      data: { status: req.body.status, handledBy: req.auth!.sub },
    });
    res.json({ data: updated });
  })
);

// Used by the customer WhatsApp inbound handler (webhook.ts) when an inbound
// message doesn't match a technician + job-update keyword.
export async function captureCustomerInbound(phone: string, text: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    // Anonymous WhatsApp visitor — log as a waitlist-style entry so ops can
    // reach out. We don't yet have an Inquiry CRM hook here; future change.
    await prisma.waitlistEntry.create({
      data: { phone, cityName: '(unknown)', source: 'WEB', pincode: undefined },
    });
    return;
  }
  await prisma.helpRequest.create({
    data: {
      userId: user.id,
      channel: 'WHATSAPP',
      topic: 'other',
      message: text.slice(0, 2000),
      status: 'OPEN',
    },
  });
}

export default router;
