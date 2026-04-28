import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../core/prisma';
import { authRequired } from '../core/auth';
import { NotFound, asyncHandler } from '../core/errors';
import { validateBody } from '../core/validate';

const router = Router();

const submitSchema = z.object({
  aadhaarLast4: z.string().regex(/^\d{4}$/),
  pan: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/),
  selfieUrl: z.string().url().optional(),
});

router.post(
  '/',
  authRequired(['CUSTOMER']),
  validateBody(submitSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof submitSchema>;
    // TODO PROD: verify Aadhaar via DigiLocker, PAN via NSDL, run liveness on selfie
    const rec = await prisma.kycRecord.create({
      data: {
        userId: req.auth!.sub,
        aadhaarLast4: body.aadhaarLast4,
        pan: body.pan,
        selfieUrl: body.selfieUrl ?? null,
        status: 'PENDING',
      },
    });
    res.status(201).json({ data: rec });
  })
);

router.get(
  '/me',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const rec = await prisma.kycRecord.findFirst({
      where: { userId: req.auth!.sub },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: rec });
  })
);

router.patch(
  '/:id/status',
  authRequired(['ADMIN']),
  validateBody(
    z.object({
      status: z.enum(['IN_REVIEW', 'VERIFIED', 'REJECTED']),
      rejectionReason: z.string().max(500).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const rec = await prisma.kycRecord.findUnique({ where: { id: req.params.id } });
    if (!rec) throw NotFound('KYC record not found');
    const updated = await prisma.kycRecord.update({
      where: { id: rec.id },
      data: {
        status: req.body.status,
        rejectionReason: req.body.rejectionReason ?? null,
        verifiedAt: req.body.status === 'VERIFIED' ? new Date() : null,
      },
    });
    res.json({ data: updated });
  })
);

router.get(
  '/',
  authRequired(['ADMIN']),
  asyncHandler(async (_req, res) => {
    const items = await prisma.kycRecord.findMany({
      include: { user: { select: { id: true, fullName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ data: items });
  })
);

export default router;
