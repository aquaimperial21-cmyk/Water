import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../core/prisma';
import { authOptional, authRequired } from '../core/auth';
import { HttpError, NotFound, asyncHandler } from '../core/errors';
import { clientKey, hit } from '../core/ratelimit';
import { validateBody, validateQuery } from '../core/validate';

const router = Router();

// ─────────────────────────── Website enquiry forms ───────────────────────────
//
// The marketing website's contact page and pop-up post here, without login.
// Each enquiry becomes an Inquiry (source WEBSITE_CONTACT / WEBSITE_POPUP)
// that the admin console's Inquiries page lists, and every active admin gets
// an in-app notification, which cron/push-outbox.ts sends on as a phone push.
//
// Spam: the form has a hidden "website" field (a honeypot) that people never
// fill. A bot that fills it gets the usual 201 and nothing is stored. Real
// submissions are rate-limited per client address and per phone number.

const INDIAN_MOBILE = /^(?:\+91|91|0)?([6-9]\d{9})$/;

/** "+91 98765-43210", "098765 43210", "9876543210" → "+919876543210"; anything else → null. */
export function normalizeIndianMobile(raw: string): string | null {
  const m = raw.replace(/[\s-]/g, '').match(INDIAN_MOBILE);
  return m ? `+91${m[1]}` : null;
}

/** An optional free-text field: trimmed and capped; "", null or missing → undefined. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || undefined);

const websiteInquirySchema = z.object({
  form: z.enum(['contact', 'popup']),
  name: z.string().trim().min(1).max(120),
  phone: z
    .string()
    .max(40)
    .transform((v, ctx) => {
      const phone = normalizeIndianMobile(v);
      if (!phone) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a 10-digit Indian mobile number' });
        return z.NEVER;
      }
      return phone;
    }),
  email: optionalText(160).refine((v) => v === undefined || z.string().email().safeParse(v).success, {
    message: 'Invalid email',
  }),
  city: optionalText(80),
  product: optionalText(200), // a product slug or display name
  heardFrom: optionalText(80),
  message: optionalText(1000),
  // "website" (the honeypot) is checked before validation; other fields are dropped.
});

const WEBSITE_SOURCE = { contact: 'WEBSITE_CONTACT', popup: 'WEBSITE_POPUP' } as const;
const IP_LIMIT = { count: 5, windowSeconds: 10 * 60 };
const PHONE_LIMIT = { count: 3, windowSeconds: 60 * 60 };

router.post(
  '/website',
  asyncHandler(async (req, res) => {
    const trap: unknown = (req.body as { website?: unknown } | undefined)?.website;
    if (trap !== undefined && trap !== null && String(trap).trim() !== '') {
      res.status(201).json({ data: { ok: true } });
      return;
    }

    const body = websiteInquirySchema.parse(req.body); // ZodError → 400 VALIDATION_ERROR

    const ip = clientKey(req.header('x-forwarded-for'), req.ip);
    const byIp = hit(`inquiry-website:ip:${ip}`, IP_LIMIT.count, IP_LIMIT.windowSeconds);
    const byPhone = byIp.allowed
      ? hit(`inquiry-website:phone:${body.phone}`, PHONE_LIMIT.count, PHONE_LIMIT.windowSeconds)
      : byIp;
    if (!byPhone.allowed) {
      res.set('Retry-After', String(byPhone.retryAfterSeconds));
      throw new HttpError(429, 'RATE_LIMITED', 'Too many enquiries. Please try again later or WhatsApp us.');
    }

    // Link the city and product when what was typed matches one of ours; the
    // text itself is kept either way.
    const [city, product] = await Promise.all([
      body.city
        ? prisma.city.findFirst({
            where: { name: { equals: body.city, mode: 'insensitive' } },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
          })
        : null,
      body.product
        ? prisma.product.findFirst({
            where: {
              isActive: true,
              OR: [
                { slug: { equals: body.product, mode: 'insensitive' } },
                { name: { equals: body.product, mode: 'insensitive' } },
              ],
            },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
          })
        : null,
    ]);

    const source = WEBSITE_SOURCE[body.form];
    await prisma.$transaction(async (tx) => {
      const inquiry = await tx.inquiry.create({
        data: {
          name: body.name,
          phone: body.phone,
          pincode: null,
          email: body.email,
          source,
          cityId: city?.id,
          cityName: body.city,
          productId: product?.id,
          productName: body.product,
          heardFrom: body.heardFrom,
          notes: body.message,
          status: 'NEW',
          events: { create: { type: 'CREATED', payload: JSON.stringify({ source }) } },
        },
        select: { id: true },
      });

      const admins = await tx.user.findMany({ where: { kind: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
      if (admins.length > 0) {
        const sentAt = new Date();
        await tx.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            channel: 'INAPP',
            title: 'New website enquiry',
            body: `${body.name} · ${body.city ?? 'city not given'} · ${body.phone}`,
            templateKey: 'inquiry.website',
            payload: JSON.stringify({ inquiryId: inquiry.id }),
            status: 'SENT',
            sentAt,
          })),
        });
      }
    });

    res.status(201).json({ data: { ok: true } });
  })
);

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
