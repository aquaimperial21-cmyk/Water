// Customer account deletion: Google Play requires it in-app, and the public
// /delete-account page promises these same rules.
//
// Refused while a rental is running (the purifier is still at the customer's
// home and their deposit hasn't come back) and while a refund is on its way.
// Otherwise the person is erased: name, contact details, addresses, KYC,
// sessions, push tokens and notifications go. The money trail stays —
// bookings, subscriptions, payments, invoices — because Indian tax law makes
// us keep it (up to 8 years); it now hangs off a nameless tombstone row. The
// phone becomes `deleted:<id>`, which frees the real number to sign up again
// as a brand-new customer.

import type { Prisma } from '@prisma/client';
import { prisma } from '../core/prisma';
import { HttpError, NotFound } from '../core/errors';

type Tx = Prisma.TransactionClient;

const DONE_TICKET = ['RESOLVED', 'CLOSED'];
const DONE_JOB = ['DONE', 'CANCELLED'];

function rupees(paise: number): string {
  return (paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: paise % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

// The same number shows up as +919876543210, 919876543210 or 9876543210
// depending on whether it came from Firebase, a legacy row or the website.
function phoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  const out = new Set([phone, digits, `+${digits}`]);
  if (digits.length === 12 && digits.startsWith('91')) out.add(digits.slice(2));
  return [...out].filter((p) => p && p !== '+');
}

async function assertDeletable(tx: Tx, userId: string): Promise<void> {
  // Any plan that isn't CLOSED blocks, expired or not: ACTIVE past its end
  // date, PAUSED, GRACE… the purifier is still on the customer's wall.
  const runningPlan = await tx.subscription.findFirst({
    where: { userId, status: { not: 'CLOSED' } },
    select: { id: true },
  });
  // Paid for but not yet (or never) turned into a closed plan.
  const paidBooking = runningPlan
    ? null
    : await tx.booking.findFirst({
        where: {
          userId,
          status: { in: ['PAID', 'INSTALLED'] },
          OR: [{ subscription: { is: null } }, { subscription: { is: { status: { not: 'CLOSED' } } } }],
        },
        select: { id: true },
      });
  if (runningPlan || paidBooking) {
    throw new HttpError(
      409,
      'ACCOUNT_HAS_ACTIVE_PLAN',
      "Your purifier plan is still running. Cancel it first from My Plan — we'll collect the purifier and refund your deposit — then delete your account. Or contact support and we'll help."
    );
  }

  // Cancelled, but the purifier hasn't been collected yet.
  const pickup =
    (await tx.ticket.findFirst({
      where: { userId, category: 'PICKUP', status: { notIn: DONE_TICKET } },
      select: { id: true },
    })) ??
    (await tx.job.findFirst({
      where: {
        type: 'PICKUP',
        status: { notIn: DONE_JOB },
        OR: [{ ticket: { is: { userId } } }, { booking: { is: { userId } } }],
      },
      select: { id: true },
    }));
  if (pickup) {
    throw new HttpError(
      409,
      'ACCOUNT_HAS_ACTIVE_PLAN',
      "We haven't collected your purifier yet. You can delete your account once the pickup is done and your deposit is refunded — or contact support."
    );
  }

  const refunds = await tx.payment.aggregate({
    where: { userId, kind: 'REFUND', status: 'INITIATED' },
    _sum: { amountPaise: true },
    _count: true,
  });
  if (refunds._count > 0) {
    throw new HttpError(
      409,
      'ACCOUNT_REFUND_PENDING',
      `We're still refunding ₹${rupees(refunds._sum.amountPaise ?? 0)}; you can delete your account once it's done.`
    );
  }
}

/**
 * Erases a customer, or throws 409 ACCOUNT_HAS_ACTIVE_PLAN /
 * ACCOUNT_REFUND_PENDING. One transaction: either all of it happens or none.
 * The caller must also cut off live access tokens (revokeAccessTokensFor).
 */
export async function deleteCustomerAccount(userId: string): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.kind !== 'CUSTOMER') throw NotFound('Account not found');
      if (user.status === 'DELETED') return; // a double tap that raced the first

      await assertDeletable(tx, userId);

      const now = new Date();
      const tombstone = `deleted:${userId}`;
      const phones = phoneVariants(user.phone);

      // Never paid for: nothing to keep open.
      const cancelledBookings = await tx.booking.updateMany({
        where: { userId, status: { in: ['PENDING_KYC', 'PENDING_PAY'] } },
        data: { status: 'CANCELLED', cancelledAt: now, cancelReason: 'ACCOUNT_DELETED' },
      });
      // Points at an address row that is about to go.
      await tx.booking.updateMany({ where: { userId, addressId: { not: null } }, data: { addressId: null } });

      // No account left to serve: no technician should turn up at the door.
      const closedTickets = await tx.ticket.updateMany({
        where: { userId, status: { notIn: DONE_TICKET } },
        data: { status: 'CLOSED' },
      });
      const cancelledJobs = await tx.job.updateMany({
        where: {
          status: { notIn: DONE_JOB },
          OR: [{ ticket: { is: { userId } } }, { booking: { is: { userId } } }],
        },
        data: { status: 'CANCELLED' },
      });

      const addresses = await tx.address.deleteMany({ where: { userId } });
      const kyc = await tx.kycRecord.deleteMany({ where: { userId } });
      const pushTokens = await tx.pushToken.deleteMany({ where: { userId } });
      const notifications = await tx.notification.deleteMany({ where: { userId } });
      // Every session, on every device.
      const sessions = await tx.refreshToken.deleteMany({ where: { userId } });

      // Support asks and sales leads stay as counts; the words and the
      // contact details in them go. Leads are matched by phone too, since
      // the website form takes them without an account.
      await tx.helpRequest.updateMany({ where: { userId }, data: { message: null } });
      const inquiries = await tx.inquiry.updateMany({
        where: { OR: [{ userId }, { phone: { in: phones } }] },
        data: { name: 'Deleted user', phone: tombstone, notes: null },
      });
      await tx.waitlistEntry.deleteMany({ where: { phone: { in: phones } } });
      await tx.otpAttempt.deleteMany({ where: { phone: { in: phones } } });
      // The purifier remembers the customer's home Wi-Fi name and LAN address.
      await tx.device.updateMany({
        where: { subscription: { is: { userId } } },
        data: { wifiSsid: null, localIp: null },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          status: 'DELETED',
          phone: tombstone,
          fullName: null,
          email: null,
          firebaseUid: null,
          passwordHash: null,
          referralCode: null,
        },
      });

      // Counts only: an erasure log must not keep what it erased.
      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'ACCOUNT_DELETE',
          entity: 'User',
          entityId: userId,
          after: JSON.stringify({
            cancelledBookings: cancelledBookings.count,
            closedTickets: closedTickets.count,
            cancelledJobs: cancelledJobs.count,
            deletedAddresses: addresses.count,
            deletedKycRecords: kyc.count,
            deletedPushTokens: pushTokens.count,
            deletedNotifications: notifications.count,
            revokedSessions: sessions.count,
            anonymisedInquiries: inquiries.count,
          }),
        },
      });
    },
    { timeout: 15_000 }
  );
}
