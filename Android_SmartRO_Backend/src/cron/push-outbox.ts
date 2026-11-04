// Every in-app notification also goes out as a phone push.
//
// The app's inbox reads Notification rows; dozens of places create them
// (payment received, installation booked, purifier active, refunds, plan
// reminders...). Rather than add a push call to each, this job runs every
// 30 s and pushes INAPP rows that haven't been pushed yet. Because it reads
// committed rows, a transaction that rolls back never sends a push.
//
// Each row is claimed (pushedAt set) before it is sent, so a push goes out at
// most once even if two runs overlap. Rows older than MAX_AGE_MS are left
// alone: after downtime, a stale "Payment received" push helps nobody.

import { prisma } from '../core/prisma';
import { sendToUser } from '../services/push';

export const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const BATCH = 100;

export async function runPushOutbox(now: Date = new Date()): Promise<{ pushed: number; noDevice: number }> {
  const due = await prisma.notification.findMany({
    where: { channel: 'INAPP', pushedAt: null, createdAt: { gte: new Date(now.getTime() - MAX_AGE_MS) } },
    orderBy: { createdAt: 'asc' },
    take: BATCH,
    select: { id: true, userId: true, title: true, body: true },
  });

  let pushed = 0;
  let noDevice = 0;
  for (const n of due) {
    const { count } = await prisma.notification.updateMany({
      where: { id: n.id, pushedAt: null },
      data: { pushedAt: now },
    });
    if (count !== 1) continue; // another run took it

    // Tapping the push opens the app's notification inbox.
    const r = await sendToUser(n.userId, {
      title: n.title,
      body: n.body,
      data: { notificationId: n.id, screen: 'Notifications' },
    });
    if (r.delivered > 0) pushed++;
    else noDevice++;
  }

  if (due.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`[cron:push-outbox] due=${due.length} pushed=${pushed} noDevice=${noDevice}`);
  }
  return { pushed, noDevice };
}
