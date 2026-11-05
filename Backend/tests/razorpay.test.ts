// Razorpay checkout flow end to end, minus the network call to Razorpay.
// Only orders.create is faked; signature checks and settlement are the real code.

import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';

// What Razorpay "has" for each order, for fetchOrderPayments.
const razorpayPayments = new Map<string, Array<{ id: string; order_id: string; status: string; amount: number }>>();

vi.mock('../src/services/razorpay', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/razorpay')>();
  return {
    ...actual,
    createOrder: vi.fn(async (args: { amountPaise: number; receipt: string }) => ({
      id: `order_T${crypto.randomBytes(7).toString('hex')}`,
      amount: args.amountPaise,
      currency: 'INR',
      receipt: args.receipt,
      status: 'created',
    })),
    fetchOrderPayments: vi.fn(async (orderId: string) => razorpayPayments.get(orderId) ?? []),
    createMandatePlan: vi.fn(async () => ({ id: 'plan_T1', item: { amount: 0, currency: 'INR', name: 'x' }, period: 'monthly', interval: 1 })),
    createMandateSubscription: vi.fn(async () => ({ id: 'sub_T1', plan_id: 'plan_T1', status: 'created', current_start: null, current_end: null, short_url: 'https://rzp.io/i/test' })),
  };
});

import { buildApp } from '../src/app';
import { prisma } from '../src/core/prisma';
import { signAccessToken } from '../src/core/auth';
import { createMandatePlan, createMandateSubscription, createOrder } from '../src/services/razorpay';
import { mandateSchedule } from '../src/modules/payment';

const KEY_SECRET = 'test_key_secret';
const WEBHOOK_SECRET = 'test_webhook_secret';
const app = buildApp();

const sign = (data: string, secret: string) => crypto.createHmac('sha256', secret).update(data).digest('hex');

let userId = '';
let token = '';
let bookingId = '';
const savedEnv = { ...process.env };
const extraUsers: string[] = [];

async function newBooking(as = token, minMonths = 1): Promise<string> {
  const price = await prisma.planCityPrice.findFirstOrThrow({
    where: { monthlyPricePaise: { gt: 0 }, plan: { durationMonths: { gte: minMonths }, isActive: true } },
  });
  const r = await request(app)
    .post('/api/v1/bookings')
    .set('Authorization', `Bearer ${as}`)
    .send({ productId: price.productId, planId: price.planId, cityId: price.cityId });
  expect(r.status).toBe(201);
  return r.body.data.id as string;
}

async function signedOrder(as = token, minMonths = 1) {
  const id = await newBooking(as, minMonths);
  await request(app).post(`/api/v1/bookings/${id}/sign-agreement`).set('Authorization', `Bearer ${as}`);
  const o = await request(app).post(`/api/v1/payments/bookings/${id}/order`).set('Authorization', `Bearer ${as}`);
  expect(o.status).toBe(201);
  return { bookingId: id, orderId: o.body.data.orderId as string, amount: o.body.data.amount as number };
}

const verifyBody = (orderId: string, paymentId: string) => ({
  razorpay_order_id: orderId,
  razorpay_payment_id: paymentId,
  razorpay_signature: sign(`${orderId}|${paymentId}`, KEY_SECRET),
});

function capturedHook(orderId: string, paymentId: string, amount: number) {
  const body = JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: { id: paymentId, order_id: orderId, status: 'captured', amount } } },
  });
  return request(app)
    .post('/api/v1/webhooks/razorpay')
    .set('Content-Type', 'application/json')
    .set('X-Razorpay-Signature', sign(body, WEBHOOK_SECRET))
    .send(body);
}

async function deleteUser(id: string) {
  const payments = await prisma.payment.findMany({ where: { userId: id }, select: { id: true } });
  await prisma.invoice.deleteMany({ where: { paymentId: { in: payments.map((p) => p.id) } } });
  await prisma.payment.deleteMany({ where: { userId: id } });
  await prisma.subscription.deleteMany({ where: { userId: id } });
  await prisma.booking.deleteMany({ where: { userId: id } });
  await prisma.notification.deleteMany({ where: { userId: id } });
  await prisma.refreshToken.deleteMany({ where: { userId: id } });
  await prisma.user.delete({ where: { id } });
}

beforeAll(async () => {
  process.env.PAYMENT_DRIVER = 'razorpay';
  process.env.RAZORPAY_KEY_ID = 'rzp_test_dummy';
  process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;

  const phone = `+9199${crypto.randomInt(10_000_000, 99_999_999)}`;
  const user = await prisma.user.create({ data: { kind: 'CUSTOMER', phone, fullName: 'Razorpay Test' } });
  userId = user.id;
  token = signAccessToken({ sub: user.id, kind: 'CUSTOMER' });
  bookingId = await newBooking();
  await request(app).post(`/api/v1/bookings/${bookingId}/sign-agreement`).set('Authorization', `Bearer ${token}`);
});

afterAll(async () => {
  process.env = savedEnv;
  // Referees before referrers.
  for (const id of [...extraUsers].reverse()) await deleteUser(id);
  await deleteUser(userId);
});

describe('Retries and duplicates', () => {
  it('hands back the same unpaid order on a retry', async () => {
    const { bookingId: id, orderId } = await signedOrder();
    const calls = vi.mocked(createOrder).mock.calls.length;
    const again = await request(app).post(`/api/v1/payments/bookings/${id}/order`).set('Authorization', `Bearer ${token}`);
    expect(again.status).toBe(201);
    expect(again.body.data.orderId).toBe(orderId);
    expect(vi.mocked(createOrder).mock.calls.length).toBe(calls);
  });

  it('queues a refund instead of failing when a second payment lands on a paid booking', async () => {
    const { bookingId: id, orderId, amount } = await signedOrder();
    const first = `pay_T${crypto.randomBytes(7).toString('hex')}`;
    expect((await request(app).post('/api/v1/payments/verify').set('Authorization', `Bearer ${token}`).send(verifyBody(orderId, first))).status).toBe(200);

    // An older order for the same booking, paid late.
    const stray = await prisma.payment.create({
      data: { userId, bookingId: id, kind: 'DEPOSIT', amountPaise: amount, status: 'INITIATED', gatewayRef: `order_T${crypto.randomBytes(7).toString('hex')}` },
    });
    const second = `pay_T${crypto.randomBytes(7).toString('hex')}`;
    const r = await capturedHook(stray.gatewayRef!, second, amount);
    expect(r.status).toBe(200);

    expect(await prisma.subscription.count({ where: { bookingId: id } })).toBe(1);
    const refund = await prisma.payment.findFirstOrThrow({ where: { bookingId: id, kind: 'REFUND' } });
    expect(refund).toMatchObject({ status: 'INITIATED', amountPaise: amount, gatewayPaymentId: second });
    expect(await prisma.invoice.count({ where: { paymentId: stray.id } })).toBe(0);
  });

  it('credits the referrer once when verify and the webhook both arrive', async () => {
    const code = `RZT${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const referrer = await prisma.user.create({
      data: { kind: 'CUSTOMER', phone: `+9198${crypto.randomInt(10_000_000, 99_999_999)}`, referralCode: code },
    });
    const referee = await prisma.user.create({
      data: { kind: 'CUSTOMER', phone: `+9197${crypto.randomInt(10_000_000, 99_999_999)}`, referredByCode: code },
    });
    extraUsers.push(referrer.id, referee.id);
    const refToken = signAccessToken({ sub: referee.id, kind: 'CUSTOMER' });

    const { orderId, amount } = await signedOrder(refToken);
    const pid = `pay_T${crypto.randomBytes(7).toString('hex')}`;
    expect((await capturedHook(orderId, pid, amount)).status).toBe(200);
    expect((await request(app).post('/api/v1/payments/verify').set('Authorization', `Bearer ${refToken}`).send(verifyBody(orderId, pid))).status).toBe(200);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: referrer.id } });
    expect(after.referralRewardPaise).toBe(Number(process.env.REFERRAL_REWARD_PAISE ?? 20000));
  });

  it('settles from Razorpay on sync when the app never got a signed result', async () => {
    const { bookingId: id, orderId, amount } = await signedOrder();
    const before = await request(app).post(`/api/v1/payments/orders/${orderId}/sync`).set('Authorization', `Bearer ${token}`);
    expect(before.body.data).toEqual({ status: 'INITIATED', settled: false });

    razorpayPayments.set(orderId, [{ id: `pay_T${crypto.randomBytes(7).toString('hex')}`, order_id: orderId, status: 'captured', amount }]);
    const after = await request(app).post(`/api/v1/payments/orders/${orderId}/sync`).set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(200);
    expect(after.body.data).toEqual({ status: 'SUCCESS', settled: true });
    expect((await prisma.booking.findUniqueOrThrow({ where: { id } })).status).toBe('PAID');
  });

  it('does not settle on sync for a captured amount that differs', async () => {
    const { orderId, amount } = await signedOrder();
    razorpayPayments.set(orderId, [{ id: `pay_T${crypto.randomBytes(7).toString('hex')}`, order_id: orderId, status: 'captured', amount: amount - 100 }]);
    const r = await request(app).post(`/api/v1/payments/orders/${orderId}/sync`).set('Authorization', `Bearer ${token}`);
    expect(r.body.data.settled).toBe(false);
  });
});

describe('Razorpay checkout', () => {
  let orderId = '';
  const rzpPaymentId = `pay_T${crypto.randomBytes(7).toString('hex')}`;

  it('reports the driver to the app', async () => {
    const r = await request(app).get('/api/v1/payments/config').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ driver: 'razorpay', keyId: 'rzp_test_dummy' });
  });

  it('creates an order for the booking total', async () => {
    const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    const r = await request(app)
      .post(`/api/v1/payments/bookings/${bookingId}/order`)
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(201);
    expect(r.body.data.keyId).toBe('rzp_test_dummy');
    expect(r.body.data.amount).toBe(b.depositPaise + b.firstPaymentPaise);
    orderId = r.body.data.orderId;
  });

  it('rejects a forged signature', async () => {
    const r = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ razorpay_order_id: orderId, razorpay_payment_id: rzpPaymentId, razorpay_signature: sign('x', 'wrong') });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('BAD_SIGNATURE');
  });

  it('settles on a valid signature and marks the booking PAID', async () => {
    const r = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({
        razorpay_order_id: orderId,
        razorpay_payment_id: rzpPaymentId,
        razorpay_signature: sign(`${orderId}|${rzpPaymentId}`, KEY_SECRET),
      });
    expect(r.status).toBe(200);
    expect(r.body.data.subscription.status).toBe('ACTIVE');

    const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(b.status).toBe('PAID');
    const pay = await prisma.payment.findFirstOrThrow({ where: { gatewayRef: orderId }, include: { invoice: true } });
    expect(pay.status).toBe('SUCCESS');
    expect(pay.gatewayPaymentId).toBe(rzpPaymentId);
    expect(pay.invoice).not.toBeNull();
  });

  it('does not settle twice when the webhook arrives after verify', async () => {
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: rzpPaymentId, order_id: orderId, status: 'captured', amount: (await prisma.payment.findFirstOrThrow({ where: { gatewayRef: orderId } })).amountPaise } } },
    });
    const r = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', sign(body, WEBHOOK_SECRET))
      .send(body);
    expect(r.status).toBe(200);
    expect(r.body.data.alreadyApplied).toBe(true);
    expect(await prisma.subscription.count({ where: { bookingId } })).toBe(1);
    expect(await prisma.invoice.count({ where: { payment: { gatewayRef: orderId } } })).toBe(1);
  });

  it('refuses a second order for a paid booking', async () => {
    const r = await request(app)
      .post(`/api/v1/payments/bookings/${bookingId}/order`)
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(400);
  });

  it('settles once when verify and the webhook race', async () => {
    const id = await newBooking();
    await request(app).post(`/api/v1/bookings/${id}/sign-agreement`).set('Authorization', `Bearer ${token}`);
    const o = await request(app).post(`/api/v1/payments/bookings/${id}/order`).set('Authorization', `Bearer ${token}`);
    const oid = o.body.data.orderId as string;
    const pid = `pay_T${crypto.randomBytes(7).toString('hex')}`;
    const hook = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: pid, order_id: oid, status: 'captured', amount: o.body.data.amount } } },
    });

    const [v, w] = await Promise.all([
      request(app)
        .post('/api/v1/payments/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sign(`${oid}|${pid}`, KEY_SECRET) }),
      request(app)
        .post('/api/v1/webhooks/razorpay')
        .set('Content-Type', 'application/json')
        .set('X-Razorpay-Signature', sign(hook, WEBHOOK_SECRET))
        .send(hook),
    ]);
    expect(v.status).toBe(200);
    expect(w.status).toBe(200);
    expect(await prisma.subscription.count({ where: { bookingId: id } })).toBe(1);
    expect(await prisma.invoice.count({ where: { payment: { gatewayRef: oid } } })).toBe(1);
  });
});

describe('Autopay', () => {
  it('debits one whole term per cycle, on the mandate schedule', async () => {
    const { orderId } = await signedOrder(token, 6); // multi-month: a 1-month plan cannot tell term from month
    const pid = `pay_T${crypto.randomBytes(7).toString('hex')}`;
    const v = await request(app).post('/api/v1/payments/verify').set('Authorization', `Bearer ${token}`).send(verifyBody(orderId, pid));
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: v.body.data.subscription.id }, include: { plan: true, booking: true } });
    const price = await prisma.planCityPrice.findUniqueOrThrow({
      where: { planId_cityId_productId: { planId: sub.planId, cityId: sub.booking.cityId, productId: sub.productId } },
    });
    const months = sub.plan.durationMonths;
    expect(months).toBeGreaterThanOrEqual(6);

    const r = await request(app).post(`/api/v1/payments/subscriptions/${sub.id}/autopay`).set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(201);
    expect(r.body.data.amountPaise).toBe(price.monthlyPricePaise * months);
    const schedule = mandateSchedule(months);
    const planArgs = vi.mocked(createMandatePlan).mock.calls.at(-1)![0];
    expect(planArgs).toMatchObject({ amountPaise: price.monthlyPricePaise * months, period: schedule.period, interval: schedule.interval });
    const subArgs = vi.mocked(createMandateSubscription).mock.calls.at(-1)![0];
    expect(subArgs.totalCount).toBe(schedule.totalCount);
    // Debits cover about two years (monthly mandates) or five (yearly ones), to the nearest term.
    const targetMonths = months % 12 === 0 ? 60 : 24;
    expect(Math.abs(subArgs.totalCount * months - targetMonths)).toBeLessThanOrEqual(months / 2);
  });
});

describe('Razorpay switched off', () => {
  it('answers 409 instead of a 500 from the SDK', async () => {
    process.env.PAYMENT_DRIVER = 'stub';
    const r = await request(app)
      .post(`/api/v1/payments/bookings/${bookingId}/order`)
      .set('Authorization', `Bearer ${token}`);
    process.env.PAYMENT_DRIVER = 'razorpay';
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('RAZORPAY_DISABLED');
  });

  it('names the missing key when the driver is on but unconfigured', async () => {
    const keep = process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_KEY_SECRET;
    const r = await request(app)
      .post(`/api/v1/payments/bookings/${bookingId}/order`)
      .set('Authorization', `Bearer ${token}`);
    process.env.RAZORPAY_KEY_SECRET = keep;
    expect(r.status).toBe(503);
    expect(r.body.error.message).toContain('RAZORPAY_KEY_SECRET');
  });
});
