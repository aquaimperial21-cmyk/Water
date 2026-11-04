// Every in-app notification also goes out as a phone push.
//
// The app's inbox reads Notification rows; dozens of places create them
// (payment received, installation booked, purifier active, refunds, plan
// reminders...). Rather than add a push call to each, this job runs every
// 30 s and pushes INAPP rows that haven't been pushed yet. Because it reads
// committed rows, a transaction that rolls back never sends a push.
//
// A row waits PUSH_DELAY_MS before it is pushed: a "Payment received" push
// that lands while Razorpay Checkout (or the UPI app) is still open can crash
// the app when tapped. And each run sends at most one push per user: several
// rows become one push (the newest title, "…and 2 more in the app"), since a
// burst of pushes during an app reload can crash it too.
//
// Each row is claimed (pushedAt set) before it is sent, so a push goes out at
// most once even if two runs overlap. Rows older than MAX_AGE_MS are left
// alone: after downtime, a stale "Payment received" push helps nobody.

import { prisma } from '../core/prisma';
import { sendToUser } from '../services/push';

export const PUSH_DELAY_MS = 90 * 1000;
export const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const BATCH = 100;

export async function runPushOutbox(now: Date = new Date()): Promise<{ pushed: number; noDevice: number }> {
  const due = await prisma.notification.findMany({
    where: {
      channel: 'INAPP',
      pushedAt: null,
      createdAt: { gte: new Date(now.getTime() - MAX_AGE_MS), lte: new Date(now.getTime() - PUSH_DELAY_MS) },
    },
    orderBy: { createdAt: 'asc' },
    take: BATCH,
    select: { id: true, userId: true, title: true, body: true },
  });

  // Each user's rows, oldest first.
  const byUser = new Map<string, typeof due>();
  for (const n of due) {
    const rows = byUser.get(n.userId);
    if (rows) rows.push(n);
    else byUser.set(n.userId, [n]);
  }

  let pushed = 0;
  let noDevice = 0;
  for (const [userId, rows] of byUser) {
    const claimed: typeof rows = [];
    for (const n of rows) {
      const { count } = await prisma.notification.updateMany({
        where: { id: n.id, pushedAt: null },
        data: { pushedAt: now },
      });
      if (count === 1) claimed.push(n); // else another run took it
    }
    if (claimed.length === 0) continue;

    // One push for all of them: the newest one, and a count of the rest.
    // Tapping it opens the app's notification inbox.
    const newest = claimed[claimed.length - 1];
    const more = claimed.length - 1;
    const r = await sendToUser(userId, {
      title: newest.title,
      body: more > 0 ? `…and ${more} more in the app` : newest.body,
      data: { notificationId: newest.id, screen: 'Notifications' },
    });
    if (r.delivered > 0) pushed++;
    else noDevice++;
  }

  if (due.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`[cron:push-outbox] due=${due.length} users=${byUser.size} pushed=${pushed} noDevice=${noDevice}`);
  }
  return { pushed, noDevice };
}
