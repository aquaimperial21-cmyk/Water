// Account deletion (POST /auth/account/delete): refused while a rental or a
// refund is still open; otherwise it erases the person, keeps the money trail
// the tax law needs, frees the phone number and ends every session.

import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Prisma } from '@prisma/client';
import { buildApp } from '../src/app';
import { prisma } from '../src/core/prisma';

const DAY = 24 * 60 * 60 * 1000;
const app = buildApp();
const phone = `+9193${crypto.randomInt(10_000_000, 99_999_999)}`;
const rnd = () => crypto.randomBytes(6).toString('hex');

let userId = '';
let accessToken = '';
let refreshToken = '';
let newUserId = '';
let price: Prisma.PlanCityPriceGetPayload<{ include: { plan: true } }>;

async function otpLogin(fullName?: string) {
  const r = await request(app).post('/api/v1/auth/otp/request').send({ phone });
  expect(r.status).toBe(200);
  const v = await request(app).post('/api/v1/auth/otp/verify').send({ phone, otp: r.body.data.devOtp, fullName });
  expect(v.status).toBe(200);
  return v.body.data as { accessToken: string; refreshToken: string; user: { id: string; phone: string } };
}

const del = (body: object = { confirm: 'DELETE' }) =>
  request(app).post('/api/v1/auth/account/delete').set('Authorization', `Bearer ${accessToken}`).send(body);

function booking(status: string, over: Partial<Prisma.BookingUncheckedCreateInput> = {}) {
  return prisma.booking.create({
    data: {
      userId,
      productId: price.productId,
      planId: price.planId,
      cityId: price.cityId,
      depositPaise: price.depositPaise,
      firstPaymentPaise: price.monthlyPricePaise * price.plan.durationMonths,
      status,
      ...over,
    },
  });
}

async function plan(status: string, over: Partial<Prisma.SubscriptionUncheckedCreateInput> = {}) {
  const b = await booking('INSTALLED');
  return prisma.subscription.create({
    data: {
      userId,
      bookingId: b.id,
      productId: price.productId,
      planId: price.planId,
      status,
      expiresAt: new Date(Date.now() + 20 * DAY),
      lockInUntil: new Date(Date.now() + 20 * DAY),
      ...over,
    },
  });
}

async function expectRefused(code: string) {
  const r = await del();
  expect(r.status).toBe(409);
  expect(r.body.error.code).toBe(code);
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  expect(u.status).toBe('ACTIVE');
  expect(u.phone).toBe(phone);
  return r.body.error.message as string;
}

beforeAll(async () => {
  price = await prisma.planCityPrice.findFirstOrThrow({
    where: { monthlyPricePaise: { gt: 0 }, plan: { isActive: true } },
    include: { plan: true },
  });
  const s = await otpLogin('Delete Me');
  userId = s.user.id;
  accessToken = s.accessToken;
  refreshToken = s.refreshToken;
});

afterAll(async () => {
  const ids = [userId, newUserId].filter(Boolean);
  const where = { userId: { in: ids } };
  await prisma.ticket.deleteMany({ where });
  const payments = await prisma.payment.findMany({ where, select: { id: true } });
  await prisma.invoice.deleteMany({ where: { paymentId: { in: payments.map((p) => p.id) } } });
  await prisma.payment.deleteMany({ where });
  await prisma.subscription.deleteMany({ where });
  await prisma.booking.deleteMany({ where });
  await prisma.notification.deleteMany({ where });
  await prisma.address.deleteMany({ where });
  await prisma.kycRecord.deleteMany({ where });
  await prisma.pushToken.deleteMany({ where });
  await prisma.refreshToken.deleteMany({ where });
  await prisma.helpRequest.deleteMany({ where });
  await prisma.inquiry.deleteMany({ where: { OR: [where, { phone: `deleted:${userId}` }] } });
  await prisma.auditLog.deleteMany({ where: { entityId: userId } });
  await prisma.otpAttempt.deleteMany({ where: { phone } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe('Account deletion', () => {
  it('needs the typed confirmation', async () => {
    expect((await del({})).status).toBe(400);
    expect((await del({ confirm: 'delete' })).status).toBe(400);
  });

  it('is refused while a plan is running or the purifier is still at home', async () => {
    const active = await plan('ACTIVE');
    const msg = await expectRefused('ACCOUNT_HAS_ACTIVE_PLAN');
    expect(msg).toMatch(/cancel/i);
    await prisma.subscription.update({ where: { id: active.id }, data: { status: 'CLOSED' } });

    // Ended and paused is still a purifier on the wall.
    const paused = await plan('PAUSED', { expiresAt: new Date(Date.now() - DAY), pausedAt: new Date(Date.now() - 2 * DAY) });
    await expectRefused('ACCOUNT_HAS_ACTIVE_PLAN');
    await prisma.subscription.update({ where: { id: paused.id }, data: { status: 'CLOSED' } });

    // Paid, but no plan made yet.
    const paid = await booking('PAID');
    await expectRefused('ACCOUNT_HAS_ACTIVE_PLAN');
    await prisma.booking.update({ where: { id: paid.id }, data: { status: 'CANCELLED' } });

    // Cancelled, but not collected yet.
    const pickup = await prisma.ticket.create({
      data: { userId, category: 'PICKUP', description: 'Pickup after cancellation', status: 'ASSIGNED' },
    });
    await expectRefused('ACCOUNT_HAS_ACTIVE_PLAN');
    await prisma.ticket.update({ where: { id: pickup.id }, data: { status: 'RESOLVED' } });
  });

  it('is refused while a refund is still on its way', async () => {
    const refund = await prisma.payment.create({
      data: { userId, kind: 'REFUND', amountPaise: 250050, status: 'INITIATED', gatewayRef: `REFUND_PENDING_${rnd()}` },
    });
    const msg = await expectRefused('ACCOUNT_REFUND_PENDING');
    expect(msg).toContain('₹2,500.50');
    await prisma.payment.update({ where: { id: refund.id }, data: { status: 'SUCCESS' } });
  });

  it('erases the person, keeps the money trail, frees the number and ends every session', async () => {
    const email = `delete-${rnd()}@example.com`;
    await prisma.user.update({ where: { id: userId }, data: { email, passwordHash: 'x', firebaseUid: `fb-${rnd()}` } });
    const address = await prisma.address.create({
      data: { userId, line1: '12 Private Lane', cityId: price.cityId, pincode: '411001', isDefault: true },
    });
    await prisma.kycRecord.create({ data: { userId, aadhaarLast4: '1234', pan: 'ABCDE1234F' } });
    await prisma.pushToken.create({ data: { userId, token: `ExponentPushToken[${rnd()}]`, platform: 'EXPO' } });
    await prisma.notification.create({ data: { userId, channel: 'INAPP', title: 'Hi', body: 'Hello' } });
    const unpaid = await booking('PENDING_PAY', { addressId: address.id });

    // A finished rental with its paperwork.
    const closed = await plan('CLOSED');
    const deposit = await prisma.payment.create({
      data: { userId, bookingId: closed.bookingId, subscriptionId: closed.id, kind: 'DEPOSIT', amountPaise: price.depositPaise, status: 'SUCCESS' },
    });
    const invoice = await prisma.invoice.create({
      data: { paymentId: deposit.id, number: `TEST-DEL-${rnd()}`, amountPaise: price.depositPaise, gstPaise: 0 },
    });
    const inquiry = await prisma.inquiry.create({
      data: { userId, name: 'Delete Me', phone, pincode: '411001', notes: 'Call after 6pm at home' },
    });
    const help = await prisma.helpRequest.create({ data: { userId, channel: 'CHAT', message: 'My address is 12 Private Lane' } });

    const paymentsBefore = await prisma.payment.count({ where: { userId } });
    const bookingsBefore = await prisma.booking.count({ where: { userId } });
    const subsBefore = await prisma.subscription.count({ where: { userId } });

    const r = await del();
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ data: { deleted: true } });

    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(u).toMatchObject({
      status: 'DELETED',
      phone: `deleted:${userId}`,
      fullName: null,
      email: null,
      firebaseUid: null,
      passwordHash: null,
      referralCode: null,
    });

    for (const n of await Promise.all([
      prisma.address.count({ where: { userId } }),
      prisma.kycRecord.count({ where: { userId } }),
      prisma.pushToken.count({ where: { userId } }),
      prisma.notification.count({ where: { userId } }),
      prisma.refreshToken.count({ where: { userId } }),
    ])) {
      expect(n).toBe(0);
    }

    // Legal retention: every payment, invoice, booking and plan is still there.
    expect(await prisma.payment.count({ where: { userId } })).toBe(paymentsBefore);
    expect(await prisma.invoice.findUnique({ where: { id: invoice.id } })).not.toBeNull();
    expect(await prisma.booking.count({ where: { userId } })).toBe(bookingsBefore);
    expect(await prisma.subscription.count({ where: { userId } })).toBe(subsBefore);
    expect(await prisma.booking.findUniqueOrThrow({ where: { id: unpaid.id } })).toMatchObject({
      status: 'CANCELLED',
      cancelReason: 'ACCOUNT_DELETED',
      addressId: null,
    });

    expect(await prisma.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } })).toMatchObject({
      name: 'Deleted user',
      phone: `deleted:${userId}`,
      notes: null,
    });
    expect((await prisma.helpRequest.findUniqueOrThrow({ where: { id: help.id } })).message).toBeNull();

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'ACCOUNT_DELETE', entityId: userId } });
    expect(audit.entity).toBe('User');
    expect(JSON.stringify(audit)).not.toContain(phone.slice(-10));
    expect(JSON.stringify(audit)).not.toContain('Delete Me');

    // The tokens the app still holds are dead.
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(401);
    const refreshed = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(refreshed.status).toBe(401);

    // The same number signs up again as somebody new.
    const again = await otpLogin();
    newUserId = again.user.id;
    expect(newUserId).not.toBe(userId);
    expect(again.user.phone).toBe(phone);
    const fresh = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${again.accessToken}`);
    expect(fresh.status).toBe(200);
    expect(fresh.body.data.addresses).toEqual([]);
  });
});
