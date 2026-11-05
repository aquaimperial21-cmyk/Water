// Referral redemption + reward credit.
//
// Reward model (configurable via env REFERRAL_REWARD_PAISE, default ₹200):
//   - Referee gets the reward applied as a credit on their first paid booking
//     (reducing firstPaymentPaise). Stored on Booking.referralCreditPaise +
//     Booking.referralCode for the invoice.
//   - Referrer gets the same amount credited to User.referralRewardPaise once
//     the referee's first booking lands in PAID/INSTALLED. Future change: settle
//     against the referrer's next recharge invoice automatically.
//
// Codes are stored on the User and exposed via /me and /referrals/me.

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../core/prisma';
import { authRequired } from '../core/auth';
import { BadRequest, NotFound, asyncHandler } from '../core/errors';
import { validateBody } from '../core/validate';

const router = Router();

const REWARD_PAISE = Number(process.env.REFERRAL_REWARD_PAISE ?? 20000);

router.get(
  '/me',
  authRequired(['CUSTOMER']),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.sub },
      select: { referralCode: true, referredByCode: true, referralRewardPaise: true },
    });
    if (!user) throw NotFound('User not found');

    // Count people who used my code
    const referrals = user.referralCode
      ? await prisma.user.count({ where: { referredByCode: user.referralCode } })
      : 0;
    res.json({
      data: {
        ...user,
        referrals,
        rewardPaiseAvailable: user.referralRewardPaise,
        rewardPaisePerReferral: REWARD_PAISE,
      },
    });
  })
);

// Apply a referral code mid-flow (e.g. user signed up first then entered a
// code at checkout). Idempotent: only credits once and only if user has no
// paid booking yet.
router.post(
  '/apply',
  authRequired(['CUSTOMER']),
  validateBody(z.object({ code: z.string().min(3).max(40) })),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } });
    if (!user) throw NotFound('User not found');
    if (user.referredByCode) throw BadRequest('A referral code is already applied to your account');

    const code = req.body.code.trim();
    const referrer = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!referrer || referrer.id === user.id) throw BadRequest('Invalid referral code');

    const paidBooking = await prisma.booking.findFirst({
      where: { userId: user.id, status: { in: ['PAID', 'INSTALLED'] } },
    });
    if (paidBooking) throw BadRequest('Referral codes can only be applied before your first paid booking');

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { referredByCode: referrer.referralCode },
      select: { referralCode: true, referredByCode: true },
    });
    res.json({ data: { ...updated, rewardPaise: REWARD_PAISE } });
  })
);

// Credit the referrer once the referee's first booking is paid. Called from
// the payment settle path (modules/payment.ts).
export async function applyReferralRewardOnFirstPayment(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.referredByCode) return;

  const paidCount = await prisma.booking.count({
    where: { userId, status: { in: ['PAID', 'INSTALLED'] } },
  });
  // This function is called *after* the booking row is updated to PAID, so
  // the count includes the current booking. Reward only on first.
  if (paidCount !== 1) return;

  const referrer = await prisma.user.findUnique({
    where: { referralCode: user.referredByCode },
  });
  if (!referrer) return;

  await prisma.user.update({
    where: { id: referrer.id },
    data: { referralRewardPaise: { increment: REWARD_PAISE } },
  });
  await prisma.notification.create({
    data: {
      userId: referrer.id,
      channel: 'INAPP',
      title: 'Referral reward earned',
      body: `${user.fullName ?? 'A friend'} just subscribed using your code. ₹${Math.round(
        REWARD_PAISE / 100
      )} credited to your account.`,
    },
  });
}

// Helper used by booking.ts to discount the firstPaymentPaise of the *referee*
// (not the referrer). Mutates nothing — caller decides whether to apply.
export async function lookupReferralCreditForUser(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.referredByCode) return 0;
  const paidCount = await prisma.booking.count({
    where: { userId, status: { in: ['PAID', 'INSTALLED'] } },
  });
  return paidCount === 0 ? REWARD_PAISE : 0;
}

export default router;
