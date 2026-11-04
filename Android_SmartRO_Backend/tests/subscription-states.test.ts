// Subscription states behind the app's My Plan screen: autopay setup and its
// gateway failures, plan switches under a mandate, mandate webhooks (closed
// plans, mandates paused at the gateway), legacy PAUSED plans from before the
// pause feature was removed, TEST products' 2-minute terms on the Razorpay
// paths, cancel, and /me. Only the Razorpay network calls are faked.

import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import type { Prisma } from '@prisma/client';

// The stub recharge reads its delay once, when subscription.ts loads.
const savedEnv = vi.hoisted(() => {
  const saved = { ...process.env };
  process.env.PAYMENT_STUB_DELAY_MS = '0';
  return saved;
});

vi.mock('../src/services/razorpay', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/razorpay')>();
  const mandate = (id: string, status: string) => ({ id, plan_id: 'plan_S1', status, current_start: null, current_end: null });
  return {
    ...actual,
    createOrder: vi.fn(async (args: { amountPaise: number; receipt: string }) => ({
      id: `order_S${crypto.randomBytes(7).toString('hex')}`,
      amount: args.amountPaise,
      currency: 'INR',
      receipt: args.receipt,
      status: 'created',
    })),
    createMandatePlan: vi.fn(async () => ({ id: 'plan_S1', item: { amount: 0, currency: 'INR', name: 'x' }, period: 'monthly', interval: 1 })),
    createMandateSubscription: vi.fn(async () => ({
      ...mandate(`sub_S${crypto.randomBytes(7).toString('hex')}`, 'created'),
      short_url: 'https://rzp.io/i/test',
    })),
    cancelMandate: vi.fn(async (id: string) => mandate(id, 'cancelled')),
  };
});

import { buildApp } from '../src/app';
import { prisma } from '../src/core/prisma';
import { signAccessToken } from '../src/core/auth';
import { addMonthsIst, istDayOfMonth } from '../src/core/time';
import { cancelMandate, createMandateSubscription } from '../src/services/razorpay';
import { TEST_TERM_MS } from '../src/core/pricing';

const WEBHOOK_SECRET = 'test_webhook_secret';
const DAY = 24 * 60 * 60 * 1000;
const app = buildApp();

let userId = '';
let token = '';
let techUserId = '';
let technicianId = '';
let price: Prisma.PlanCityPriceGetPayload<{ include: { plan: true } }>;
let otherPlanId = '';
/** A price on a product tagged TEST (2-minute terms), made for this file. */
let testPrice: Prisma.PlanCityPriceGetPayload<{ include: { plan: true } }>;
let testProductId = '';

const rnd = () => crypto.randomBytes(6).toString('hex');
const post = (path: string, body: object = {}) =>
  request(app).post(`/api/v1${path}`).set('Authorization', `Bearer ${token}`).send(body);

/** A booking + subscription on `on` (default `price`), 5 days in with 20 left unless overridden. */
async function makeSub(over: Partial<Prisma.SubscriptionUncheckedCreateInput> = {}, on = price) {
  const booking = await prisma.booking.create({
    data: {
      userId,
      productId: on.productId,
      planId: on.planId,
      cityId: on.cityId,
      depositPaise: on.depositPaise,
      firstPaymentPaise: on.monthlyPricePaise * on.plan.durationMonths,
      status: 'PAID',
    },
  });
  const now = Date.now();
  return prisma.subscription.create({
    data: {
      userId,
      bookingId: booking.id,
      productId: on.productId,
      planId: on.planId,
      status: 'ACTIVE',
      startedAt: new Date(now - 5 * DAY),
      expiresAt: new Date(now + 20 * DAY),
      lockInUntil: new Date(now + 20 * DAY),
      ...over,
    },
  });
}

const reload = (id: string) => prisma.subscription.findUniqueOrThrow({ where: { id } });

function webhook(payload: object) {
  const body = JSON.stringify(payload);
  return request(app)
    .post('/api/v1/webhooks/razorpay')
    .set('Content-Type', 'application/json')
    .set('X-Razorpay-Signature', crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex'))
    .send(body);
}

function job(data: { bookingId?: string; ticketId?: string; type: string; status: string; at: number }) {
  return prisma.job.create({
    data: {
      technicianId,
      bookingId: data.bookingId,
      ticketId: data.ticketId,
      type: data.type,
      status: data.status,
      scheduledFor: new Date(Date.now() + data.at),
    },
  });
}

beforeAll(async () => {
  process.env.PAYMENT_DRIVER = 'razorpay';
  process.env.RAZORPAY_KEY_ID = 'rzp_test_dummy';
  process.env.RAZORPAY_KEY_SECRET = 'test_key_secret';
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;

  // A priced plan that has a second active plan for the same city + product.
  const prices = await prisma.planCityPrice.findMany({
    where: { monthlyPricePaise: { gt: 0 }, plan: { isActive: true } },
    include: { plan: true },
  });
  const found = prices.find((p) =>
    prices.some((q) => q.cityId === p.cityId && q.productId === p.productId && q.planId !== p.planId)
  );
  if (!found) throw new Error('seed data needs two active plans priced for one city + product');
  price = found;
  otherPlanId = prices.find((q) => q.cityId === price.cityId && q.productId === price.productId && q.planId !== price.planId)!.planId;

  const user = await prisma.user.create({
    data: { kind: 'CUSTOMER', phone: `+9195${crypto.randomInt(10_000_000, 99_999_999)}`, fullName: 'Sub States Test' },
  });
  userId = user.id;
  token = signAccessToken({ sub: user.id, kind: 'CUSTOMER' });

  const techUser = await prisma.user.create({
    data: { kind: 'TECHNICIAN', phone: `+9194${crypto.randomInt(10_000_000, 99_999_999)}`, fullName: 'Sub States Tech' },
  });
  techUserId = techUser.id;
  technicianId = (await prisma.technician.create({ data: { userId: techUser.id, employeeCode: `TST-${rnd()}`, zone: 'TEST' } })).id;

  // Like the live "TEST Purifier ₹1": tagged TEST, priced on the same plan + city.
  const testProduct = await prisma.product.create({
    data: {
      slug: `test-term-${rnd()}`,
      name: 'TEST term purifier',
      kind: 'HOME',
      capacityLitres: 8,
      technology: 'RO',
      mounting: 'WALL',
      description: 'Sub states test product',
      tag: 'TEST',
    },
  });
  testProductId = testProduct.id;
  testPrice = await prisma.planCityPrice.create({
    data: { planId: price.planId, cityId: price.cityId, productId: testProduct.id, monthlyPricePaise: 100, depositPaise: 0 },
    include: { plan: true },
  });
});

afterAll(async () => {
  process.env = savedEnv;
  await prisma.job.deleteMany({ where: { technicianId } });
  await prisma.ticket.deleteMany({ where: { userId } });
  const payments = await prisma.payment.findMany({ where: { userId }, select: { id: true } });
  await prisma.invoice.deleteMany({ where: { paymentId: { in: payments.map((p) => p.id) } } });
  await prisma.payment.deleteMany({ where: { userId } });
  await prisma.subscription.deleteMany({ where: { userId } });
  await prisma.booking.deleteMany({ where: { userId } });
  await prisma.notification.deleteMany({ where: { userId } });
  await prisma.planCityPrice.deleteMany({ where: { productId: testProductId } });
  await prisma.product.deleteMany({ where: { id: testProductId } });
  await prisma.technician.delete({ where: { id: technicianId } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, techUserId] } } });
});

describe('Autopay gateway errors', () => {
  it('answers 502 on cancel instead of a 500', async () => {
    const sub = await makeSub({ autopayId: `sub_S${rnd()}`, autopayStatus: 'ACTIVE' });
    vi.mocked(cancelMandate).mockRejectedValueOnce(new Error('timeout'));
    const c = await post(`/payments/subscriptions/${sub.id}/autopay/cancel`);
    expect(c.status).toBe(502);
    expect(c.body.error.code).toBe('AUTOPAY_GATEWAY_ERROR');
    expect((await reload(sub.id)).autopayStatus).toBe('ACTIVE');
  });
});

describe('Pause is gone', () => {
  it('has no pause or resume routes, for the plan or its autopay', async () => {
    const sub = await makeSub({ autopayId: `sub_S${rnd()}`, autopayStatus: 'ACTIVE' });
    for (const path of [
      `/subscriptions/${sub.id}/pause`,
      `/subscriptions/${sub.id}/resume`,
      `/payments/subscriptions/${sub.id}/autopay/pause`,
      `/payments/subscriptions/${sub.id}/autopay/resume`,
    ]) {
      expect((await post(path)).status).toBe(404);
    }
    expect(await reload(sub.id)).toMatchObject({ status: 'ACTIVE', autopayStatus: 'ACTIVE', pausedAt: null });
  });
});

describe('Legacy PAUSED plans', () => {
  // Nothing creates PAUSED any more; a leftover row is just a plan that isn't
  // running. The app shows it as inactive with Recharge and Set up autopay.
  const legacy = (over: Partial<Prisma.SubscriptionUncheckedCreateInput> = {}) =>
    makeSub({ status: 'PAUSED', pausedAt: new Date(Date.now() - 10 * DAY), ...over });

  it('recharges (Razorpay order + payment.captured) to ACTIVE, one term from the later of now and its end', async () => {
    const sub = await legacy();
    const order = await post(`/payments/subscriptions/${sub.id}/order`);
    expect(order.status).toBe(201);
    const r = await webhook({
      event: 'payment.captured',
      payload: { payment: { entity: { id: `pay_S${rnd()}`, order_id: order.body.data.orderId, status: 'captured', amount: order.body.data.amount } } },
    });
    expect(r.status).toBe(200);
    const after = await reload(sub.id);
    expect(after).toMatchObject({ status: 'ACTIVE', pausedAt: null });
    // Its end was still 20 days out, so the term goes on top of it.
    expect(after.expiresAt.toISOString()).toBe(
      addMonthsIst(sub.expiresAt, price.plan.durationMonths, istDayOfMonth(sub.startedAt)).toISOString()
    );
  });

  it('recharges on the stub driver too, from now when its end has passed', async () => {
    const sub = await legacy({ expiresAt: new Date(Date.now() - 3 * DAY), lockInUntil: new Date(Date.now() - 3 * DAY) });
    process.env.PAYMENT_DRIVER = 'stub';
    try {
      const at = Date.now();
      const r = await post(`/subscriptions/${sub.id}/recharge`);
      expect(r.status).toBe(200);
      const after = await reload(sub.id);
      expect(after).toMatchObject({ status: 'ACTIVE', pausedAt: null });
      expect(after.expiresAt.getTime()).toBeGreaterThan(at + 27 * DAY);
      expect(after.expiresAt.getTime()).toBeLessThanOrEqual(addMonthsIst(new Date(), price.plan.durationMonths, istDayOfMonth(sub.startedAt)).getTime());
    } finally {
      process.env.PAYMENT_DRIVER = 'razorpay';
    }
  });

  it('lets autopay be set up', async () => {
    const sub = await legacy();
    const r = await post(`/payments/subscriptions/${sub.id}/autopay`);
    expect(r.status).toBe(201);
    expect(await reload(sub.id)).toMatchObject({ status: 'PAUSED', autopayStatus: 'CREATED', autopayId: r.body.data.autopayId });
  });

  it('turns ACTIVE on an autopay debit, like any other stopped plan', async () => {
    const autopayId = `sub_S${rnd()}`;
    const sub = await legacy({ autopayId, autopayStatus: 'ACTIVE' });
    const r = await webhook({
      event: 'subscription.charged',
      payload: {
        subscription: { entity: { id: autopayId, status: 'active' } },
        payment: { entity: { id: `pay_S${rnd()}`, order_id: `order_S${rnd()}`, status: 'captured', amount: 49900 } },
      },
    });
    expect(r.status).toBe(200);
    const after = await reload(sub.id);
    expect(after).toMatchObject({ status: 'ACTIVE', pausedAt: null });
    expect(after.expiresAt.toISOString()).toBe(
      addMonthsIst(sub.expiresAt, price.plan.durationMonths, istDayOfMonth(sub.startedAt)).toISOString()
    );
  });
});

describe('Autopay setup', () => {
  it('is refused on a closed plan', async () => {
    const calls = vi.mocked(createMandateSubscription).mock.calls.length;
    const closed = await makeSub({ status: 'CLOSED' });
    const c = await post(`/payments/subscriptions/${closed.id}/autopay`);
    expect(c.status).toBe(400);
    expect(c.body.error.message).toBe('This plan is closed');
    expect(vi.mocked(createMandateSubscription).mock.calls.length).toBe(calls);
  });

  it('replaces a mandate that was paused at the gateway', async () => {
    const paused = `sub_S${rnd()}`;
    const sub = await makeSub({ autopayId: paused, autopayStatus: 'PAUSED' });
    const r = await post(`/payments/subscriptions/${sub.id}/autopay`);
    expect(r.status).toBe(201);
    expect(vi.mocked(cancelMandate)).toHaveBeenLastCalledWith(paused, false);
    expect(await reload(sub.id)).toMatchObject({ autopayStatus: 'CREATED', autopayId: r.body.data.autopayId });
  });

  it('schedules the first debit on the renewal date', async () => {
    const sub = await makeSub();
    const r = await post(`/payments/subscriptions/${sub.id}/autopay`);
    expect(r.status).toBe(201);
    expect(r.body.data.firstDebitAt).toBe(sub.expiresAt.toISOString());
    const args = vi.mocked(createMandateSubscription).mock.calls.at(-1)![0];
    expect(args.startAt?.toISOString()).toBe(sub.expiresAt.toISOString());
    expect(await reload(sub.id)).toMatchObject({ autopayStatus: 'CREATED', autopayId: r.body.data.autopayId });
  });

  it('debits straight away for a plan that has ended', async () => {
    const sub = await makeSub({ expiresAt: new Date(Date.now() - DAY) });
    const r = await post(`/payments/subscriptions/${sub.id}/autopay`);
    expect(r.status).toBe(201);
    expect(r.body.data.firstDebitAt).toBeNull();
    expect(vi.mocked(createMandateSubscription).mock.calls.at(-1)![0].startAt).toBeUndefined();
  });

  it('cancels a mandate whose authorisation never finished, even if that cancel fails', async () => {
    const stale = `sub_S${rnd()}`;
    const sub = await makeSub({ autopayId: stale, autopayStatus: 'CREATED' });
    vi.mocked(cancelMandate).mockRejectedValueOnce(new Error('already expired'));
    const r = await post(`/payments/subscriptions/${sub.id}/autopay`);
    expect(r.status).toBe(201);
    expect(vi.mocked(cancelMandate)).toHaveBeenLastCalledWith(stale, false);
    const after = await reload(sub.id);
    expect(after.autopayId).not.toBe(stale);
    expect(after.autopayStatus).toBe('CREATED');
  });

  it('reports a live mandate as already active', async () => {
    const sub = await makeSub({ autopayId: `sub_S${rnd()}`, autopayStatus: 'ACTIVE' });
    const r = await post(`/payments/subscriptions/${sub.id}/autopay`);
    expect(r.status).toBe(200);
    expect(r.body.data.alreadyActive).toBe(true);
  });
});

describe('Plan switch under autopay', () => {
  it('is refused on the Razorpay order and the stub recharge, while renewing the same plan is not', async () => {
    const sub = await makeSub({ autopayId: `sub_S${rnd()}`, autopayStatus: 'ACTIVE' });
    const sw = await post(`/payments/subscriptions/${sub.id}/order`, { planId: otherPlanId });
    expect(sw.status).toBe(409);
    expect(sw.body.error.message).toBe('Turn off autopay before switching plans');

    const same = await post(`/payments/subscriptions/${sub.id}/order`, { planId: price.planId });
    expect(same.status).toBe(201);

    process.env.PAYMENT_DRIVER = 'stub';
    try {
      const stub = await post(`/subscriptions/${sub.id}/recharge`, { planId: otherPlanId });
      expect(stub.status).toBe(409);
      expect(stub.body.error.message).toBe('Turn off autopay before switching plans');
    } finally {
      process.env.PAYMENT_DRIVER = 'razorpay';
    }
  });

  it('is allowed without autopay', async () => {
    const sub = await makeSub();
    const r = await post(`/payments/subscriptions/${sub.id}/order`, { planId: otherPlanId });
    expect(r.status).toBe(201);
    expect(r.body.data.planId).toBe(otherPlanId);
  });
});

describe('Mandate webhooks', () => {
  const charged = (autopayId: string, paymentId: string, amount: number) =>
    webhook({
      event: 'subscription.charged',
      payload: {
        subscription: { entity: { id: autopayId, status: 'active' } },
        payment: { entity: { id: paymentId, order_id: `order_S${rnd()}`, status: 'captured', amount } },
      },
    });

  it('owes a debit on a closed plan back instead of dropping it', async () => {
    const autopayId = `sub_S${rnd()}`;
    const sub = await makeSub({ status: 'CLOSED', autopayId, autopayStatus: 'CANCEL_FAILED' });
    const pid = `pay_S${rnd()}`;
    const r = await charged(autopayId, pid, 49900);
    expect(r.status).toBe(200);
    expect(r.body.data.refundQueued).toBe(true);

    const rows = await prisma.payment.findMany({ where: { subscriptionId: sub.id }, orderBy: { kind: 'asc' } });
    expect(rows.map((p) => [p.kind, p.status, p.amountPaise, p.gatewayPaymentId])).toEqual([
      ['RECHARGE', 'SUCCESS', 49900, pid],
      ['REFUND', 'INITIATED', 49900, pid],
    ]);
    expect(await prisma.notification.count({ where: { userId, title: 'Refund on the way' } })).toBeGreaterThan(0);
    expect(await reload(sub.id)).toMatchObject({ status: 'CLOSED', autopayStatus: 'CANCELLED' });

    const again = await charged(autopayId, pid, 49900);
    expect(again.body.data.alreadyApplied).toBe(true);
    expect(await prisma.payment.count({ where: { subscriptionId: sub.id, kind: 'REFUND' } })).toBe(1);
  });

  it('extends a running plan by one term', async () => {
    const autopayId = `sub_S${rnd()}`;
    const sub = await makeSub({ autopayId, autopayStatus: 'ACTIVE' });
    expect((await charged(autopayId, `pay_S${rnd()}`, 49900)).status).toBe(200);
    const after = await reload(sub.id);
    expect(after.status).toBe('ACTIVE');
    expect(after.expiresAt.toISOString()).toBe(
      addMonthsIst(sub.expiresAt, price.plan.durationMonths, istDayOfMonth(sub.startedAt)).toISOString()
    );
  });

  it('records a mandate paused and resumed at the gateway, leaving the plan alone', async () => {
    const autopayId = `sub_S${rnd()}`;
    const sub = await makeSub({ autopayId, autopayStatus: 'ACTIVE' });
    await webhook({ event: 'subscription.paused', payload: { subscription: { entity: { id: autopayId, status: 'paused' } } } });
    expect(await reload(sub.id)).toMatchObject({ status: 'ACTIVE', autopayStatus: 'PAUSED', pausedAt: null });
    await webhook({ event: 'subscription.resumed', payload: { subscription: { entity: { id: autopayId, status: 'active' } } } });
    expect(await reload(sub.id)).toMatchObject({ status: 'ACTIVE', autopayStatus: 'ACTIVE' });
  });

  it('records pending and completed mandates', async () => {
    const autopayId = `sub_S${rnd()}`;
    const sub = await makeSub({ autopayId, autopayStatus: 'ACTIVE' });
    await webhook({ event: 'subscription.pending', payload: { subscription: { entity: { id: autopayId, status: 'pending' } } } });
    expect((await reload(sub.id)).autopayStatus).toBe('PENDING');
    await webhook({ event: 'subscription.completed', payload: { subscription: { entity: { id: autopayId, status: 'completed' } } } });
    expect((await reload(sub.id)).autopayStatus).toBe('COMPLETED');
  });

  it('does not activate a mandate on a closed plan', async () => {
    const autopayId = `sub_S${rnd()}`;
    const sub = await makeSub({ status: 'CLOSED', autopayId, autopayStatus: 'CREATED' });
    const before = await prisma.notification.count({ where: { userId, title: 'Autopay activated' } });
    const r = await webhook({ event: 'subscription.activated', payload: { subscription: { entity: { id: autopayId, status: 'active' } } } });
    expect(r.status).toBe(200);
    expect(vi.mocked(cancelMandate)).toHaveBeenLastCalledWith(autopayId, false);
    expect((await reload(sub.id)).autopayStatus).toBe('CANCELLED');
    expect(await prisma.notification.count({ where: { userId, title: 'Autopay activated' } })).toBe(before);
  });
});

describe('TEST products get 2-minute terms on the Razorpay paths', () => {
  const near = (d: Date, ms: number) => expect(Math.abs(d.getTime() - ms)).toBeLessThan(5000);

  it('booking payment (checkout /verify): the plan runs two minutes from now', async () => {
    const b = await prisma.booking.create({
      data: {
        userId,
        productId: testPrice.productId,
        planId: testPrice.planId,
        cityId: testPrice.cityId,
        depositPaise: testPrice.depositPaise,
        firstPaymentPaise: testPrice.monthlyPricePaise * testPrice.plan.durationMonths,
        status: 'PENDING_PAY',
        agreementSignedAt: new Date(),
      },
    });
    const order = await post(`/payments/bookings/${b.id}/order`);
    expect(order.status).toBe(201);
    const paymentId = `pay_S${rnd()}`;
    const signature = crypto.createHmac('sha256', 'test_key_secret').update(`${order.body.data.orderId}|${paymentId}`).digest('hex');
    const at = Date.now();
    const v = await post('/payments/verify', {
      razorpay_order_id: order.body.data.orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    });
    expect(v.status).toBe(200);
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { bookingId: b.id } });
    near(sub.expiresAt, at + TEST_TERM_MS);
    expect(sub.expiresAt.getTime() - sub.startedAt.getTime()).toBe(TEST_TERM_MS);
    expect(sub.lockInUntil.toISOString()).toBe(sub.expiresAt.toISOString());
    expect(sub.trialEndsAt?.toISOString()).toBe(sub.expiresAt.toISOString());
  });

  it('recharge order on an ended plan (payment.captured webhook): two minutes from now, at the normal price', async () => {
    const sub = await makeSub({ expiresAt: new Date(Date.now() - DAY), lockInUntil: new Date(Date.now() - DAY) }, testPrice);
    const order = await post(`/payments/subscriptions/${sub.id}/order`);
    expect(order.status).toBe(201);
    expect(order.body.data.amount).toBe(testPrice.monthlyPricePaise * testPrice.plan.durationMonths);
    const at = Date.now();
    const r = await webhook({
      event: 'payment.captured',
      payload: { payment: { entity: { id: `pay_S${rnd()}`, order_id: order.body.data.orderId, status: 'captured', amount: order.body.data.amount } } },
    });
    expect(r.status).toBe(200);
    const after = await reload(sub.id);
    expect(after.status).toBe('ACTIVE');
    near(after.expiresAt, at + TEST_TERM_MS);
  });

  it('autopay debit on a running plan (subscription.charged): two minutes on top of the current end', async () => {
    const autopayId = `sub_S${rnd()}`;
    const sub = await makeSub({ expiresAt: new Date(Date.now() + 30_000), autopayId, autopayStatus: 'ACTIVE' }, testPrice);
    const r = await webhook({
      event: 'subscription.charged',
      payload: {
        subscription: { entity: { id: autopayId, status: 'active' } },
        payment: { entity: { id: `pay_S${rnd()}`, order_id: `order_S${rnd()}`, status: 'captured', amount: 100 } },
      },
    });
    expect(r.status).toBe(200);
    expect((await reload(sub.id)).expiresAt.getTime()).toBe(sub.expiresAt.getTime() + TEST_TERM_MS);
  });
});

describe('Cancel', () => {
  it('cancels open install visits for the booking', async () => {
    const sub = await makeSub({ trialEndsAt: new Date(Date.now() + 3 * DAY) });
    const scheduled = await job({ bookingId: sub.bookingId, type: 'INSTALL', status: 'SCHEDULED', at: DAY });
    const enRoute = await job({ bookingId: sub.bookingId, type: 'INSTALL', status: 'EN_ROUTE', at: 0 });
    const done = await job({ bookingId: sub.bookingId, type: 'INSTALL', status: 'DONE', at: -DAY });

    const r = await post(`/subscriptions/${sub.id}/cancel`);
    expect(r.status).toBe(200);
    const status = async (id: string) => (await prisma.job.findUniqueOrThrow({ where: { id } })).status;
    expect(await status(scheduled.id)).toBe('CANCELLED');
    expect(await status(enRoute.id)).toBe('CANCELLED');
    expect(await status(done.id)).toBe('DONE');
  });
});

describe('GET /subscriptions/me', () => {
  it('carries the latest refund and the next visit from the booking or a ticket', async () => {
    const a = await makeSub();
    const b = await makeSub();
    const c = await makeSub();

    await prisma.payment.create({
      data: { userId, subscriptionId: a.id, kind: 'REFUND', amountPaise: 100, status: 'SUCCESS', createdAt: new Date(Date.now() - 2 * DAY) },
    });
    const latest = await prisma.payment.create({
      data: { userId, subscriptionId: a.id, kind: 'REFUND', amountPaise: 250000, status: 'INITIATED' },
    });

    // a: the install is next; a finished visit and one long past don't count.
    const install = await job({ bookingId: a.bookingId, type: 'INSTALL', status: 'SCHEDULED', at: 2 * DAY });
    await job({ bookingId: a.bookingId, type: 'SERVICE', status: 'DONE', at: 60 * 60 * 1000 });
    await job({ bookingId: a.bookingId, type: 'SERVICE', status: 'SCHEDULED', at: -2 * DAY });
    // b: a ticket visit running late (12h past its slot) beats a later booking job.
    const ticket = await prisma.ticket.create({
      data: { userId, subscriptionId: b.id, category: 'REPAIR', description: 'Leak' },
    });
    const late = await job({ ticketId: ticket.id, type: 'SERVICE', status: 'IN_PROGRESS', at: -12 * 60 * 60 * 1000 });
    await job({ bookingId: b.bookingId, type: 'FILTER', status: 'SCHEDULED', at: 5 * DAY });

    const r = await request(app).get('/api/v1/subscriptions/me').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    const byId = new Map<string, { refund: unknown; nextVisit: unknown; plan: unknown }>(
      r.body.data.map((s: { id: string }) => [s.id, s])
    );

    expect(byId.get(a.id)!.refund).toEqual({ amountPaise: 250000, status: 'INITIATED', createdAt: latest.createdAt.toISOString() });
    expect(byId.get(a.id)!.nextVisit).toEqual({ scheduledFor: install.scheduledFor.toISOString(), type: 'INSTALL' });
    expect(byId.get(a.id)!.plan).toBeTruthy(); // existing includes kept

    expect(byId.get(b.id)!.refund).toBeNull();
    expect(byId.get(b.id)!.nextVisit).toEqual({ scheduledFor: late.scheduledFor.toISOString(), type: 'SERVICE' });

    expect(byId.get(c.id)!.refund).toBeNull();
    expect(byId.get(c.id)!.nextVisit).toBeNull();
  });
});
