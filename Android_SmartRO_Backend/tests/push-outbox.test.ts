// In-app notifications go out as phone pushes (cron/push-outbox.ts): once
// each, only recent ones, and only INAPP rows. Reminders and broadcasts use
// INAPP now that WhatsApp isn't connected. The Expo call itself is faked.

import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const pushed = vi.hoisted(() => [] as { userId: string; title: string; data?: Record<string, string> }[]);
vi.mock('../src/services/push', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/push')>();
  return {
    ...actual,
    sendToUser: vi.fn(async (userId: string, payload: { title: string; data?: Record<string, string> }) => {
      pushed.push({ userId, title: payload.title, data: payload.data });
      return { delivered: 1, failed: 0 };
    }),
  };
});

import { prisma } from '../src/core/prisma';
import { runPushOutbox, MAX_AGE_MS } from '../src/cron/push-outbox';
import { dispatch } from '../src/services/notifications';
import { renderTemplate } from '../src/services/messaging/templates';

let userId = '';
const mine = () => pushed.filter((p) => p.userId === userId);

beforeAll(async () => {
  const u = await prisma.user.create({
    data: { kind: 'CUSTOMER', phone: `+9198${crypto.randomInt(10_000_000, 99_999_999)}`, fullName: 'Push Test' },
  });
  userId = u.id;
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

beforeEach(() => {
  pushed.length = 0;
});

describe('Push outbox', () => {
  it('pushes a new in-app notification once, pointing at the inbox', async () => {
    const n = await prisma.notification.create({
      data: { userId, channel: 'INAPP', title: 'Payment received', body: 'x', status: 'SENT' },
    });
    await runPushOutbox();
    await runPushOutbox();
    expect(mine()).toHaveLength(1);
    expect(mine()[0]!.title).toBe('Payment received');
    expect(mine()[0]!.data).toEqual({ notificationId: n.id, screen: 'Notifications' });
    const after = await prisma.notification.findUniqueOrThrow({ where: { id: n.id } });
    expect(after.pushedAt).not.toBeNull();
  });

  it('skips old rows, rows already pushed, and other channels', async () => {
    await prisma.notification.create({
      data: { userId, channel: 'INAPP', title: 'Old', body: 'x', status: 'SENT', createdAt: new Date(Date.now() - MAX_AGE_MS - 60_000) },
    });
    await prisma.notification.create({
      data: { userId, channel: 'INAPP', title: 'Done', body: 'x', status: 'SENT', pushedAt: new Date() },
    });
    await prisma.notification.create({
      data: { userId, channel: 'WHATSAPP', title: 'WhatsApp', body: 'x', status: 'SENT' },
    });
    await runPushOutbox();
    expect(mine()).toHaveLength(0);
  });

  it('pushes in-app messages sent through dispatch (reminders, broadcasts)', async () => {
    const r = await dispatch({
      userId,
      to: '+910000000000',
      channel: 'INAPP',
      templateKey: 'recharge.reminder.3d',
      vars: { name: 'Push Test', productName: 'AquaPure' },
    });
    expect(r.sent).toBe(true);
    await runPushOutbox();
    expect(mine().map((p) => p.title)).toEqual(['Recharge in 3 days']);
  });
});

describe('Reminder text', () => {
  it('points at the app when there is no link, and keeps a link when given', () => {
    expect(renderTemplate('recharge.reminder.1d', { productName: 'AquaPure' }).body).toMatch(/running\. Open the app to recharge\.$/);
    expect(renderTemplate('recharge.reminder.1d', { rechargeLink: 'https://x.in/r' }).body).toMatch(/running: https:\/\/x\.in\/r$/);
    expect(renderTemplate('recharge.reminder.7d', {}).body).not.toContain('app://');
  });
});
