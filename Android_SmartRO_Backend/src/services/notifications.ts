// Notification orchestrator.
// Creates a Notification row (audit + idempotency), dispatches via the
// configured messaging driver, then marks status SENT/FAILED.

import { prisma } from '../core/prisma';
import { getMessagingDriver, Channel, TemplateKey } from './messaging';
import { renderTemplate } from './messaging/templates';
import { sendToUser as sendPushToUser } from './push';

export interface DispatchOpts {
  userId: string;
  to: string;
  channel: Channel;
  templateKey: TemplateKey;
  vars: Record<string, string>;
  /** When provided, prevents same template firing twice for this user on the same date. */
  idempotencyDate?: Date;
}

export async function dispatch(opts: DispatchOpts): Promise<{ notificationId: string; sent: boolean; reason?: string }>
{
  const { userId, to, channel, templateKey, vars, idempotencyDate } = opts;

  // Idempotency guard — same user + template + day = skip.
  if (idempotencyDate) {
    const dayStart = new Date(idempotencyDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        templateKey,
        scheduledAt: { gte: dayStart, lt: dayEnd },
        status: { in: ['SENT', 'DELIVERED', 'PENDING'] },
      },
    });
    if (existing) {
      return { notificationId: existing.id, sent: false, reason: 'duplicate' };
    }
  }

  const { title, body } = renderTemplate(templateKey, vars);

  const row = await prisma.notification.create({
    data: {
      userId,
      channel,
      title,
      body,
      templateKey,
      status: 'PENDING',
      scheduledAt: idempotencyDate ?? new Date(),
      payload: JSON.stringify(vars),
      attemptCount: 1,
    },
  });

  try {
    if (channel === 'PUSH') {
      const result = await sendPushToUser(userId, { title, body, data: vars });
      await prisma.notification.update({
        where: { id: row.id },
        data: {
          status: result.delivered > 0 ? 'SENT' : 'FAILED',
          sentAt: new Date(),
          providerMessageId: `expo:${result.delivered}/${result.delivered + result.failed}`,
        },
      });
      return { notificationId: row.id, sent: result.delivered > 0 };
    }
    const driver = getMessagingDriver();
    const r = await driver.send({ to, channel, templateKey, vars });
    await prisma.notification.update({
      where: { id: row.id },
      data: { status: 'SENT', sentAt: new Date(), providerMessageId: r.providerMessageId },
    });
    return { notificationId: row.id, sent: true };
  } catch (e) {
    await prisma.notification.update({
      where: { id: row.id },
      data: { status: 'FAILED' },
    });
    return { notificationId: row.id, sent: false, reason: (e as Error).message };
  }
}

/** Convenience helper for in-app only (no driver call). */
export async function inAppOnly(userId: string, title: string, body: string) {
  return prisma.notification.create({
    data: { userId, channel: 'INAPP', title, body, status: 'SENT', sentAt: new Date() },
  });
}
