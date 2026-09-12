import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../core/prisma';
import {
  authRequired,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  signAccessToken,
} from '../core/auth';
import { BadRequest, NotFound, Unauthorized, asyncHandler } from '../core/errors';
import { validateBody } from '../core/validate';
import { getMessagingDriver } from '../services/messaging';

const router = Router();

const phoneSchema = z.string().regex(/^\+?\d{10,15}$/, 'Invalid phone');

const otpRequestSchema = z.object({ phone: phoneSchema });
const otpVerifySchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6),
  fullName: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  referralCode: z.string().min(3).max(40).optional(),
});
const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const OTP_TTL_SEC = Number(process.env.OTP_TTL_SECONDS ?? 300);
const OTP_DEV_RETURN = (process.env.OTP_DEV_RETURN ?? 'true') === 'true';

function genOtp(): string {
  // Deterministic dev OTP for the seeded demo customer; random otherwise.
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post(
  '/otp/request',
  validateBody(otpRequestSchema),
  asyncHandler(async (req, res) => {
    const { phone } = req.body as z.infer<typeof otpRequestSchema>;

    // Rate-limit: 3 otp requests / 10 min
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recent = await prisma.otpAttempt.count({
      where: { phone, createdAt: { gte: tenMinAgo } },
    });
    if (recent >= 3) {
      throw BadRequest('Too many OTP requests. Try again in a few minutes.');
    }

    const otp = genOtp();
    await prisma.otpAttempt.create({
      data: {
        phone,
        otp,
        expiresAt: new Date(Date.now() + OTP_TTL_SEC * 1000),
      },
    });

    try {
      await getMessagingDriver().send({
        to: phone,
        channel: 'SMS',
        templateKey: 'auth.otp',
        vars: { otp, ttlMinutes: String(Math.round(OTP_TTL_SEC / 60)) },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[auth] OTP dispatch failed', err);
      if (!OTP_DEV_RETURN) {
        throw BadRequest('Could not send OTP right now. Please try again shortly.');
      }
    }

    res.json({
      data: {
        sent: true,
        ...(OTP_DEV_RETURN ? { devOtp: otp } : {}),
      },
    });
  })
);

router.post(
  '/otp/verify',
  validateBody(otpVerifySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof otpVerifySchema>;
    const attempt = await prisma.otpAttempt.findFirst({
      where: { phone: body.phone, otp: body.otp, consumed: false, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!attempt) throw Unauthorized('Invalid or expired OTP');

    await prisma.otpAttempt.update({ where: { id: attempt.id }, data: { consumed: true } });

    // Referral: validate the code refers to an existing user (and not the
    // signing-in user themselves). Apply only on first signup, not relogin.
    let referredByCode: string | null = null;
    if (body.referralCode) {
      const referrer = await prisma.user.findUnique({ where: { referralCode: body.referralCode } });
      if (referrer && referrer.phone !== body.phone) {
        referredByCode = referrer.referralCode;
      }
    }

    let user = await prisma.user.findUnique({ where: { phone: body.phone } });
    if (!user) {
      // Auto-generate a sharable referralCode from name + 4 random digits.
      const seed = (body.fullName ?? body.phone).replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
      const ownReferral = `${seed || 'SMARTRO'}-${Math.floor(1000 + Math.random() * 9000)}`;
      user = await prisma.user.create({
        data: {
          kind: 'CUSTOMER',
          phone: body.phone,
          fullName: body.fullName ?? null,
          email: body.email ?? null,
          referralCode: ownReferral,
          referredByCode,
        },
      });
    } else if (body.fullName && !user.fullName) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          fullName: body.fullName,
          email: body.email ?? user.email,
          referredByCode: user.referredByCode ?? referredByCode,
        },
      });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const accessToken = signAccessToken({ sub: user.id, kind: user.kind as 'CUSTOMER' | 'ADMIN' | 'TECHNICIAN' });
    const refreshToken = await issueRefreshToken(user.id);

    res.json({
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          kind: user.kind,
          phone: user.phone,
          email: user.email,
          fullName: user.fullName,
        },
      },
    });
  })
);

router.post(
  '/admin/login',
  validateBody(adminLoginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof adminLoginSchema>;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash || (user.kind !== 'ADMIN' && user.kind !== 'TECHNICIAN')) {
      throw Unauthorized('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw Unauthorized('Invalid credentials');

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const accessToken = signAccessToken({ sub: user.id, kind: user.kind as 'ADMIN' | 'TECHNICIAN' });
    const refreshToken = await issueRefreshToken(user.id);
    res.json({
      data: {
        accessToken,
        refreshToken,
        user: { id: user.id, kind: user.kind, email: user.email, fullName: user.fullName },
      },
    });
  })
);

router.post(
  '/refresh',
  validateBody(z.object({ refreshToken: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const rotated = await rotateRefreshToken(refreshToken);
    const accessToken = signAccessToken({ sub: rotated.userId, kind: rotated.kind });
    res.json({ data: { accessToken, refreshToken: rotated.newToken } });
  })
);

router.post(
  '/logout',
  authRequired(),
  validateBody(z.object({ refreshToken: z.string().min(1).optional() })),
  asyncHandler(async (req, res) => {
    if (req.body.refreshToken) await revokeRefreshToken(req.body.refreshToken);
    res.json({ data: { ok: true } });
  })
);

router.get(
  '/me',
  authRequired(),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.sub },
      include: { addresses: { include: { city: true } } },
    });
    if (!user) throw NotFound('User not found');
    res.json({
      data: {
        id: user.id,
        kind: user.kind,
        phone: user.phone,
        email: user.email,
        fullName: user.fullName,
        addresses: user.addresses,
      },
    });
  })
);

export default router;
