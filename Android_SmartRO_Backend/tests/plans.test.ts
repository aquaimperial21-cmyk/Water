// Plans: admin management, calendar-month terms end to end, autopay cadence,
// and the IST month arithmetic the terms are built on.

import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';

// The stub gateway reads its delay once, when booking.ts loads: set it before then.
const savedEnv = vi.hoisted(() => {
  const saved = { driver: process.env.PAYMENT_DRIVER, delay: process.env.PAYMENT_STUB_DELAY_MS };
  process.env.PAYMENT_STUB_DELAY_MS = '0';
  return saved;
});

import { buildApp } from '../src/app';
import { prisma } from '../src/core/prisma';
import { signAccessToken } from '../src/core/auth';
import { addMonthsIst, istDayOfMonth } from '../src/core/time';
import { mandateSchedule } from '../src/modules/payment';

const app = buildApp();

let adminToken = '';
let userId = '';
let token = '';
const createdPlanIds: string[] = [];

/** The instant that reads `y-m-d h:min` on an Indian clock (IST is UTC+5:30, no DST). */
const ist = (y: number, m: number, d: number, h = 10, min = 0) =>
  new Date(Date.UTC(y, m - 1, d, h, min) - 330 * 60 * 1000);

/** A plan length (7–35 months) no plan in the database uses, so a create can't clash. */
async function unusedMonths(): Promise<number> {
  const taken = new Set((await prisma.plan.findMany({ select: { durationMonths: true } })).map((p) => p.durationMonths));
  const free = Array.from({ length: 29 }, (_, i) => i + 7).filter((m) => !taken.has(m));
  return free[crypto.randomInt(free.length)]!;
}

/** Book `months` on a priced active plan, sign, and pay through the stub gateway. */
async function bookAndPay(months: number) {
  const price = await prisma.planCityPrice.findFirstOrThrow({
    where: { monthlyPricePaise: { gt: 0 }, plan: { durationMonths: months, isActive: true } },
  });
  const b = await request(app)
    .post('/api/v1/bookings')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId: price.productId, planId: price.planId, cityId: price.cityId });
  expect(b.status).toBe(201);

  await request(app).post(`/api/v1/bookings/${b.body.data.id}/sign-agreement`).set('Authorization', `Bearer ${token}`);
  process.env.PAYMENT_DRIVER = 'stub';
  const paid = await request(app).post(`/api/v1/bookings/${b.body.data.id}/pay`).set('Authorization', `Bearer ${token}`);
  expect(paid.status).toBe(200);
  const sub = await prisma.subscription.findUniqueOrThrow({ where: { bookingId: b.body.data.id } });
  return { price, booking: b.body.data as { firstPaymentPaise: number; depositPaise: number }, sub };
}

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { kind: 'ADMIN' } });
  adminToken = signAccessToken({ sub: admin.id, kind: 'ADMIN' });
  const user = await prisma.user.create({
    data: { kind: 'CUSTOMER', phone: `+9196${crypto.randomInt(10_000_000, 99_999_999)}`, fullName: 'Plan Test' },
  });
  userId = user.id;
  token = signAccessToken({ sub: user.id, kind: 'CUSTOMER' });
});

afterAll(async () => {
  process.env.PAYMENT_DRIVER = savedEnv.driver;
  process.env.PAYMENT_STUB_DELAY_MS = savedEnv.delay;
  const payments = await prisma.payment.findMany({ where: { userId }, select: { id: true } });
  await prisma.invoice.deleteMany({ where: { paymentId: { in: payments.map((p) => p.id) } } });
  await prisma.payment.deleteMany({ where: { userId } });
  await prisma.subscription.deleteMany({ where: { userId } });
  await prisma.booking.deleteMany({ where: { userId } });
  await prisma.notification.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.planCityPrice.deleteMany({ where: { planId: { in: createdPlanIds } } });
  await prisma.auditLog.deleteMany({ where: { entity: 'Plan', entityId: { in: createdPlanIds } } });
  await prisma.plan.deleteMany({ where: { id: { in: createdPlanIds } } });
});

describe('Admin plans', () => {
  it('creates a plan, refuses a second active one of the same length, and switches it off', async () => {
    const months = await unusedMonths();
    const made = await request(app)
      .post('/api/v1/admin/plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Test ${months} months`, durationMonths: months });
    expect(made.status).toBe(201);
    createdPlanIds.push(made.body.data.id);
    expect(made.body.data.durationMonths).toBe(months);

    const dup = await request(app)
      .post('/api/v1/admin/plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dup', durationMonths: months });
    expect(dup.status).toBe(409);

    const off = await request(app)
      .patch(`/api/v1/admin/plans/${made.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(off.status).toBe(200);
    expect(off.body.data.isActive).toBe(false);

    const list = await request(app).get('/api/v1/admin/plans').set('Authorization', `Bearer ${adminToken}`);
    const row = list.body.data.find((p: { id: string }) => p.id === made.body.data.id);
    expect(row).toMatchObject({ isActive: false, durationMonths: months, _count: { prices: 0, subscriptions: 0 } });
    const pub = await request(app).get('/api/v1/plans');
    expect(pub.body.data.some((p: { id: string }) => p.id === made.body.data.id)).toBe(false);
  });

  it('refuses a length outside 1–36 months', async () => {
    for (const durationMonths of [0, 37]) {
      const r = await request(app)
        .post('/api/v1/admin/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Bad length', durationMonths });
      expect(r.status).toBe(400);
    }
  });

  it('does not let a plan length be edited', async () => {
    const plan = await prisma.plan.findFirstOrThrow({ where: { durationMonths: 1 } });
    const r = await request(app)
      .patch(`/api/v1/admin/plans/${plan.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ durationMonths: 2 });
    expect(r.status).toBe(400);
    expect((await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).durationMonths).toBe(1);
  });

  it('is admin-only', async () => {
    const r = await request(app)
      .post('/api/v1/admin/plans')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'x', durationMonths: 2 });
    expect(r.status).toBe(403);
  });
});

describe('Calendar-month terms', () => {
  it('sells the 1-month plan for one month plus deposit, running to the same date next month', async () => {
    const { price, booking, sub } = await bookAndPay(1);
    expect(booking.firstPaymentPaise).toBe(price.monthlyPricePaise);
    expect(booking.depositPaise).toBe(price.depositPaise);
    expect(sub.expiresAt.toISOString()).toBe(addMonthsIst(sub.startedAt, 1).toISOString());
    // Lock-in is one term, not a flat 180 days.
    expect(sub.lockInUntil.toISOString()).toBe(sub.expiresAt.toISOString());
  });

  it('charges a 6-month plan for six months and locks in for those six', async () => {
    const { price, booking, sub } = await bookAndPay(6);
    expect(booking.firstPaymentPaise).toBe(price.monthlyPricePaise * 6);
    expect(sub.expiresAt.toISOString()).toBe(addMonthsIst(sub.startedAt, 6).toISOString());
    expect(sub.lockInUntil.toISOString()).toBe(addMonthsIst(sub.startedAt, 6).toISOString());
  });

  it('is not sold once switched off', async () => {
    const months = await unusedMonths();
    const plan = await prisma.plan.create({ data: { name: `Temp ${months} months`, durationMonths: months } });
    createdPlanIds.push(plan.id);
    const base = await prisma.planCityPrice.findFirstOrThrow({ where: { plan: { durationMonths: 1 } } });
    await prisma.planCityPrice.create({
      data: { planId: plan.id, cityId: base.cityId, productId: base.productId, monthlyPricePaise: 50000, depositPaise: 0 },
    });
    await prisma.plan.update({ where: { id: plan.id }, data: { isActive: false } });

    const listed = await request(app).get(`/api/v1/pricing?productId=${base.productId}&cityId=${base.cityId}`);
    expect(listed.body.data.some((p: { planId: string }) => p.planId === plan.id)).toBe(false);
    const b = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: base.productId, planId: plan.id, cityId: base.cityId });
    expect(b.status).toBe(400);
  });
});

describe('Autopay cadence', () => {
  it.each([
    [1, 'monthly', 1, 24],
    [3, 'monthly', 3, 8],
    [6, 'monthly', 6, 4],
    [12, 'yearly', 1, 5],
    [24, 'yearly', 2, 3],
  ])('%i months → every %s ×%i, %i debits', (months, period, interval, totalCount) => {
    expect(mandateSchedule(months)).toEqual({ period, interval, totalCount });
  });
});

describe('addMonthsIst', () => {
  it('clamps to the end of a short month', () => {
    expect(addMonthsIst(ist(2027, 1, 31), 1)).toEqual(ist(2027, 2, 28));
    expect(addMonthsIst(ist(2028, 1, 31), 1)).toEqual(ist(2028, 2, 29)); // leap year
  });

  it('keeps the date and the time of day', () => {
    expect(addMonthsIst(ist(2027, 3, 15, 10, 0), 1)).toEqual(ist(2027, 4, 15, 10, 0));
  });

  it('rolls over the year', () => {
    expect(addMonthsIst(ist(2026, 11, 30), 3)).toEqual(ist(2027, 2, 28));
    expect(addMonthsIst(ist(2026, 12, 5), 12)).toEqual(ist(2027, 12, 5));
  });

  it('snaps a clamped month end back to the anchor day', () => {
    expect(addMonthsIst(ist(2027, 2, 28), 1, 31)).toEqual(ist(2027, 3, 31));
    // Not a month end: the anchor does not apply.
    expect(addMonthsIst(ist(2027, 2, 27), 1, 31)).toEqual(ist(2027, 3, 27));
  });

  it('reads the Indian calendar, not UTC', () => {
    const at = new Date('2027-01-30T20:00:00Z'); // 30 Jan in UTC, 31 Jan 01:30 in IST
    expect(istDayOfMonth(at)).toBe(31);
    expect(addMonthsIst(at, 1)).toEqual(ist(2027, 2, 28, 1, 30));
  });
});
