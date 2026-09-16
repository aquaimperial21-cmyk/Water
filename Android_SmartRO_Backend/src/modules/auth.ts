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
import { verifyFirebasePhoneToken } from '../core/firebase';
import { clear as clearRateLimit, hit as rateLimitHit } from '../core/ratelimit';
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
// Customers sign in by phone, not email — email is optional on a customer row.
const passwordLoginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1),
});
const passwordSetSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  currentPassword: z.string().min(1).optional(),
});
const firebaseLoginSchema = z.object({
  idToken: z.string().min(1),
  fullName: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  referralCode: z.string().min(3).max(40).optional(),
  // The admin console sends 'STAFF' so a customer who completes a perfectly
  // valid phone login cannot use that token to reach staff surfaces.
  audience: z.enum(['CUSTOMER', 'STAFF']).default('CUSTOMER'),
});

const OTP_TTL_SEC = Number(process.env.OTP_TTL_SECONDS ?? 300);
const OTP_DEV_RETURN = (process.env.OTP_DEV_RETURN ?? 'true') === 'true';

// A referral code counts only when it belongs to someone other than the caller.
async function resolveReferrer(code: string | undefined, phone: string): Promise<string | null> {
  if (!code) return null;
  const referrer = await prisma.user.findUnique({ where: { referralCode: code } });
  if (!referrer || referrer.phone === phone) return null;
  return referrer.referralCode;
}

// Firebase always reports E.164 (+919876543210). Rows seeded before this
// migration may carry the bare national number, so match both.
function phoneVariants(phone: string): string[] {
  return phone.startsWith('+') ? [phone, phone.slice(1)] : [phone, '+' + phone];
}

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

    // A 6-digit code with unlimited guesses is not a secret. Without this, an
    // attacker walks the whole 000000-999999 space against any number —
    // including staff — and the token below carries that account's role.
    const limitKey = `otpverify:${body.phone}`;
    const limit = rateLimitHit(limitKey, 5, 900);
    if (!limit.allowed) {
      throw Unauthorized(
        `Too many incorrect codes. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`
      );
    }

    const attempt = await prisma.otpAttempt.findFirst({
      where: { phone: body.phone, otp: body.otp, consumed: false, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!attempt) throw Unauthorized('Invalid or expired OTP');

    await prisma.otpAttempt.update({ where: { id: attempt.id }, data: { consumed: true } });
    clearRateLimit(limitKey);

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

    // Customer sign-in only. Staff sign in at /auth/admin/login with a
    // password; minting an ADMIN token here would make an SMS code the only
    // thing between an attacker and the ops console. Same checks the other
    // two login paths already make.
    if (user.kind !== 'CUSTOMER') throw Unauthorized('Invalid or expired OTP');
    if (user.status !== 'ACTIVE') throw Unauthorized('This account is not active');

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
  '/firebase',
  validateBody(firebaseLoginSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof firebaseLoginSchema>;
    const identity = await verifyFirebasePhoneToken(body.idToken);

    // Match on the Firebase uid first, then fall back to phone so users who
    // existed before this migration are adopted rather than duplicated.
    let user = await prisma.user.findUnique({ where: { firebaseUid: identity.uid } });
    if (!user) {
      user = await prisma.user.findFirst({ where: { phone: { in: phoneVariants(identity.phone) } } });
    }

    if (!user) {
      if (body.audience === 'STAFF') {
        // Never auto-create staff. An unknown number at the console is a
        // wrong-number login, not a new admin.
        throw Unauthorized('No staff account for this number');
      }
      const referredByCode = await resolveReferrer(body.referralCode, identity.phone);
      const seed = (body.fullName ?? identity.phone).replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
      user = await prisma.user.create({
        data: {
          kind: 'CUSTOMER',
          phone: identity.phone,
          firebaseUid: identity.uid,
          fullName: body.fullName ?? null,
          email: body.email ?? null,
          referralCode: `${seed || 'SMARTRO'}-${Math.floor(1000 + Math.random() * 9000)}`,
          referredByCode,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          firebaseUid: identity.uid,
          phone: identity.phone, // normalise legacy rows to E.164
          fullName: user.fullName ?? body.fullName ?? null,
          email: user.email ?? body.email ?? null,
        },
      });
    }

    if (user.status !== 'ACTIVE') throw Unauthorized('This account is not active');
    if (body.audience === 'STAFF' && user.kind !== 'ADMIN' && user.kind !== 'TECHNICIAN') {
      throw Unauthorized('No staff account for this number');
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const kind = user.kind as 'CUSTOMER' | 'ADMIN' | 'TECHNICIAN';
    const accessToken = signAccessToken({ sub: user.id, kind });
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

// A customer can only get a password after a first OTP login, so this is a
// returning-user path: no account is ever created here.
router.post(
  '/password/login',
  validateBody(passwordLoginSchema),
  asyncHandler(async (req, res) => {
    const { phone, password } = req.body as z.infer<typeof passwordLoginSchema>;

    const limitKey = `pwlogin:${phone}`;
    const limit = rateLimitHit(limitKey, 5, 900);
    if (!limit.allowed) {
      throw BadRequest(
        `Too many failed attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes, or sign in with an OTP.`
      );
    }

    const user = await prisma.user.findFirst({ where: { phone: { in: phoneVariants(phone) } } });
    // Same message either way so this cannot be used to enumerate numbers.
    if (!user || !user.passwordHash) throw Unauthorized('Invalid phone or password');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw Unauthorized('Invalid phone or password');
    if (user.status !== 'ACTIVE') throw Unauthorized('This account is not active');

    clearRateLimit(limitKey);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const kind = user.kind as 'CUSTOMER' | 'ADMIN' | 'TECHNICIAN';
    const accessToken = signAccessToken({ sub: user.id, kind });
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

// Set or change your own password. Requires a live session — which means the
// caller proved the phone number by OTP at some point. That also makes OTP the
// password-reset path: sign in with a code, set a new one.
router.post(
  '/password/set',
  authRequired(),
  validateBody(passwordSetSchema),
  asyncHandler(async (req, res) => {
    const { password, currentPassword } = req.body as z.infer<typeof passwordSetSchema>;
    const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
    if (!user) throw NotFound('User not found');

    // Changing an existing password needs the old one; setting the first does not.
    if (user.passwordHash) {
      if (!currentPassword) throw BadRequest('Enter your current password');
      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) throw Unauthorized('Current password is incorrect');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });

    res.json({ data: { ok: true, hasPassword: true } });
  })
);

router.post(
  '/admin/login',
  validateBody(adminLoginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof adminLoginSchema>;

    // The console runs the whole business. Unlimited guesses against a known
    // staff address is the one door left wide open; /auth/password/login has
    // had this cap since it was written.
    const limitKey = `adminlogin:${email.toLowerCase()}`;
    const limit = rateLimitHit(limitKey, 5, 900);
    if (!limit.allowed) {
      throw Unauthorized(
        `Too many failed attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash || (user.kind !== 'ADMIN' && user.kind !== 'TECHNICIAN')) {
      throw Unauthorized('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw Unauthorized('Invalid credentials');
    if (user.status !== 'ACTIVE') throw Unauthorized('This account is not active');

    clearRateLimit(limitKey);
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
        hasPassword: Boolean(user.passwordHash),
        addresses: user.addresses,
      },
    });
  })
);

export default router;
