// Daily — finds subscriptions expiring in 7 / 3 / 1 days and dispatches a
// WhatsApp reminder via the messaging driver. Idempotent: each (user, template,
// day) combination only fires once.

import { prisma } from '../core/prisma';
import { formatIst, istSlotStart } from '../core/time';
import { dispatch } from '../services/notifications';
import type { TemplateKey } from '../services/messaging';

function fmt(d: Date) {
  return formatIst(d, { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * The IST calendar day `daysFromNow` days ahead, as [IST midnight, next IST
 * midnight). Host midnight is 05:30 IST on a UTC container, so a plan ending
 * before 05:30 was reminded a day off and "1 day left" could mean today.
 */
export function istDayWindow(daysFromNow: number, now = new Date()): { start: Date; end: Date } {
  return { start: istSlotStart(now, daysFromNow, 0), end: istSlotStart(now, daysFromNow + 1, 0) };
}

const TIERS: { days: 7 | 3 | 1; key: TemplateKey }[] = [
  { days: 7, key: 'recharge.reminder.7d' },
  { days: 3, key: 'recharge.reminder.3d' },
  { days: 1, key: 'recharge.reminder.1d' },
];

export async function runExpiryReminders(): Promise<{ checked: number; sent: number; skipped: number }> {
  let checked = 0;
  let sent = 0;
  let skipped = 0;

  for (const tier of TIERS) {
    const { start, end } = istDayWindow(tier.days);
    const subs = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { gte: start, lt: end },
        // Autopay renews these on its own; "recharge now" would invite a
        // second payment for the same term. Spelled out because SQL's
        // `<> 'ACTIVE'` drops the NULL (no mandate) rows too.
        OR: [{ autopayStatus: null }, { autopayStatus: { not: 'ACTIVE' } }],
      },
      include: { user: true, product: true },
    });

    for (const s of subs) {
      checked++;
      const phone = s.user.phone;
      if (!phone) {
        skipped++;
        continue;
      }
      const r = await dispatch({
        userId: s.userId,
        to: phone,
        channel: 'WHATSAPP',
        templateKey: tier.key,
        vars: {
          name: s.user.fullName ?? 'there',
          productName: s.product.name,
          daysLeft: String(tier.days),
          expiryDate: fmt(s.expiresAt),
          rechargeLink: `https://imperialaqua.in/recharge/${s.id}`,
        },
        idempotencyDate: new Date(),
      });
      if (r.sent) sent++;
      else skipped++;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[cron:expiry-reminders] checked=${checked} sent=${sent} skipped=${skipped}`);
  return { checked, sent, skipped };
}
