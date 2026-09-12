// Daily — finds subscriptions expiring in 7 / 3 / 1 days and dispatches a
// WhatsApp reminder via the messaging driver. Idempotent: each (user, template,
// day) combination only fires once.

import { prisma } from '../core/prisma';
import { dispatch } from '../services/notifications';
import type { TemplateKey } from '../services/messaging';

function fmt(d: Date) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function dayWindow(daysFromNow: number): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + daysFromNow);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
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
    const { start, end } = dayWindow(tier.days);
    const subs = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { gte: start, lt: end },
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
