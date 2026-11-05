// In-app notifications go out as phone pushes (cron/push-outbox.ts): once
// each, only recent ones, and only INAPP rows. A new row waits PUSH_DELAY_MS,
// and a run sends at most one push per user. Reminders and broadcasts use
// INAPP now that WhatsApp isn't connected. The Expo call itself is faked.

import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const pushed = vi.hoisted(() => [] as { userId: string; title: string; body: string; data?: Record<string, string> }[]);
vi.mock('../src/services/push', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/push')>();
  return {
    ...actual,
    sendToUser: vi.fn(async (userId: string, payload: { title: string; body: string; data?: Record<string, string> }) => {
      pushed.push({ userId, title: payload.title, body: payload.body, data: payload.data });
      return { delivered: 1, failed: 0 };
    }),
  };
});

import { prisma } from '../src/core/prisma';
import { runPushOutbox, MAX_AGE_MS, PUSH_DELAY_MS } from '../src/cron/push-outbox';
import { dispatch } from '../src/services/notifications';
import { renderTemplate } from '../src/services/messaging/templates';

let userId = '';
let otherId = '';
const mine = () => pushed.filter((p) => p.userId === userId);
const ago = (ms: number) => new Date(Date.now() - ms);
const DUE = PUSH_DELAY_MS + 60_000; // old enough to push

const newCustomer = (fullName: string) =>
  prisma.user.create({
    data: { kind: 'CUSTOMER', phone: `+9198${crypto.randomInt(10_000_000, 99_999_999)}`, fullName },
  });

beforeAll(async () => {
  userId = (await newCustomer('Push Test')).id;
  otherId = (await newCustomer('Push Test 2')).id;
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { userId: { in: [userId, otherId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  pushed.length = 0;
  // A row left over from an earlier test would join this test's push.
  await prisma.notification.deleteMany({ where: { userId: { in: [userId, otherId] } } });
});

describe('Push outbox', () => {
  it('pushes an in-app notification once, pointing at the inbox', async () => {
    const n = await prisma.notification.create({
      data: { userId, channel: 'INAPP', title: 'Payment received', body: 'x', status: 'SENT', createdAt: ago(DUE) },
    });
    await runPushOutbox();
    await runPushOutbox();
    expect(mine()).toEqual([
      { userId, title: 'Payment received', body: 'x', data: { notificationId: n.id, screen: 'Notifications' } },
    ]);
    const after = await prisma.notification.findUniqueOrThrow({ where: { id: n.id } });
    expect(after.pushedAt).not.toBeNull();
  });

  it(`waits until a new row is ${PUSH_DELAY_MS / 1000} s old`, async () => {
    // Brand new: the customer may still be on the payment screen.
    const n = await prisma.notification.create({
      data: { userId, channel: 'INAPP', title: 'Payment received', body: 'x', status: 'SENT' },
    });
    await runPushOutbox();
    expect(mine()).toHaveLength(0);

    await prisma.notification.update({ where: { id: n.id }, data: { createdAt: ago(PUSH_DELAY_MS - 10_000) } });
    await runPushOutbox();
    expect(mine()).toHaveLength(0);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: n.id } })).pushedAt).toBeNull();

    await prisma.notification.update({ where: { id: n.id }, data: { createdAt: ago(PUSH_DELAY_MS) } });
    await runPushOutbox();
    expect(mine().map((p) => p.title)).toEqual(['Payment received']);
  });

  it('sends one push per user: the newest title and how many more are waiting', async () => {
    // Created out of order: "newest" goes by createdAt.
    const newest = await prisma.notification.create({
      data: { userId, channel: 'INAPP', title: 'Recharge successful', body: 'x', status: 'SENT', createdAt: ago(DUE) },
    });
    const paid = await prisma.notification.create({
      data: { userId, channel: 'INAPP', title: 'Payment received', body: 'x', status: 'SENT', createdAt: ago(DUE + 60_000) },
    });
    const booked = await prisma.notification.create({
      data: { userId, channel: 'INAPP', title: 'Installation booked', body: 'x', status: 'SENT', createdAt: ago(DUE + 120_000) },
    });
    const other = await prisma.notification.create({
      data: { userId: otherId, channel: 'INAPP', title: 'Refund on the way', body: 'y', status: 'SENT', createdAt: ago(DUE) },
    });

    await runPushOutbox();
    await runPushOutbox();

    expect(mine()).toEqual([
      { userId, title: 'Recharge successful', body: '…and 2 more in the app', data: { notificationId: newest.id, screen: 'Notifications' } },
    ]);
    // Another customer's row is a push of its own.
    expect(pushed.filter((p) => p.userId === otherId).map((p) => [p.title, p.body])).toEqual([['Refund on the way', 'y']]);
    const rows = await prisma.notification.findMany({ where: { id: { in: [newest.id, paid.id, booked.id, other.id] } } });
    expect(rows).toHaveLength(4);
    for (const r of rows) expect(r.pushedAt).not.toBeNull();
  });

  it('skips old rows, rows already pushed, and other channels', async () => {
    await prisma.notification.create({
      data: { userId, channel: 'INAPP', title: 'Old', body: 'x', status: 'SENT', createdAt: ago(MAX_AGE_MS + 60_000) },
    });
    await prisma.notification.create({
      data: { userId, channel: 'INAPP', title: 'Done', body: 'x', status: 'SENT', pushedAt: new Date(), createdAt: ago(DUE) },
    });
    await prisma.notification.create({
      data: { userId, channel: 'WHATSAPP', title: 'WhatsApp', body: 'x', status: 'SENT', createdAt: ago(DUE) },
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
    await prisma.notification.update({ where: { id: r.notificationId }, data: { createdAt: ago(DUE) } });
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
