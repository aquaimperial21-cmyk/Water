// GET /admin/bookings: the console's list of every booking, with customer,
// product, city, latest payment, subscription and the open install job.

import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';
import { prisma } from '../src/core/prisma';
import { signAccessToken } from '../src/core/auth';

const app = buildApp();

let adminToken = '';
let customerToken = '';
let userId = '';
let cityId = '';
let productName = '';
let cityName = '';
let paidId = '';
let pendingId = '';
let subscriptionId = '';
let deviceId = '';
let jobId = '';
let techUserId = '';
let techId = '';
const techCode = `TST-${crypto.randomBytes(6).toString('hex')}`;
const deviceToken = `tok-${crypto.randomBytes(12).toString('hex')}`;

const rnd = () => crypto.randomBytes(6).toString('hex');
const phone = () => `+9192${crypto.randomInt(10_000_000, 99_999_999)}`;

const list = (query = '', bearer: string | null = adminToken) => {
  const r = request(app).get(`/api/v1/admin/bookings${query}`);
  return bearer ? r.set('Authorization', `Bearer ${bearer}`) : r;
};

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { kind: 'ADMIN' } });
  adminToken = signAccessToken({ sub: admin.id, kind: 'ADMIN' });
  const user = await prisma.user.create({ data: { kind: 'CUSTOMER', phone: phone(), fullName: 'Admin Bookings Test' } });
  userId = user.id;
  customerToken = signAccessToken({ sub: user.id, kind: 'CUSTOMER' });
  const techUser = await prisma.user.create({ data: { kind: 'TECHNICIAN', phone: phone(), fullName: 'Admin Bookings Tech' } });
  techUserId = techUser.id;
  // ON_LEAVE so the install-slot auto-assign in other tests never picks it.
  techId = (await prisma.technician.create({
    data: { userId: techUser.id, employeeCode: techCode, zone: 'TEST', status: 'ON_LEAVE', isActive: false },
  })).id;

  const price = await prisma.planCityPrice.findFirstOrThrow({
    where: { plan: { isActive: true } },
    include: { product: true, city: true },
  });
  cityId = price.cityId;
  productName = price.product.name;
  cityName = price.city.name;
  const base = {
    userId,
    productId: price.productId,
    planId: price.planId,
    cityId: price.cityId,
    depositPaise: price.depositPaise,
    firstPaymentPaise: price.monthlyPricePaise,
  };

  // A minute older, so the newest-first check can't tie.
  pendingId = (await prisma.booking.create({
    data: { ...base, status: 'PENDING_PAY', agreementSignedAt: new Date(), createdAt: new Date(Date.now() - 60_000) },
  })).id;
  const paid = await prisma.booking.create({ data: { ...base, status: 'PAID', agreementSignedAt: new Date() } });
  paidId = paid.id;

  await prisma.payment.create({
    data: { userId, bookingId: paidId, kind: 'DEPOSIT', amountPaise: base.depositPaise + base.firstPaymentPaise, status: 'SUCCESS' },
  });
  // A device with a token on the subscription: the list must not expose it.
  const device = await prisma.device.create({
    data: { serial: `SR-TEST-BK-${rnd()}`, qr: `QR-TEST-BK-${rnd()}`, productId: price.productId, status: 'ALLOCATED', deviceToken },
  });
  deviceId = device.id;
  const now = Date.now();
  const sub = await prisma.subscription.create({
    data: {
      userId,
      bookingId: paidId,
      productId: price.productId,
      planId: price.planId,
      deviceId,
      status: 'ACTIVE',
      expiresAt: new Date(now + 30 * 86400_000),
      lockInUntil: new Date(now + 30 * 86400_000),
    },
  });
  subscriptionId = sub.id;
  // Booked when no technician was free.
  const job = await prisma.job.create({
    data: { bookingId: paidId, technicianId: null, type: 'INSTALL', status: 'SCHEDULED', scheduledFor: new Date(now + 2 * 86400_000) },
  });
  jobId = job.id;
});

afterAll(async () => {
  await prisma.job.deleteMany({ where: { bookingId: { in: [paidId, pendingId] } } });
  await prisma.payment.deleteMany({ where: { userId } });
  await prisma.subscription.deleteMany({ where: { userId } });
  await prisma.device.deleteMany({ where: { id: deviceId } });
  await prisma.booking.deleteMany({ where: { userId } });
  await prisma.technician.deleteMany({ where: { id: techId } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, techUserId] } } });
});

describe('GET /admin/bookings', () => {
  it('lists a booking with its customer, product, city, payment, subscription and install job', async () => {
    const r = await list(`?cityId=${cityId}&perPage=100`);
    expect(r.status).toBe(200);
    const row = r.body.data.find((b: { id: string }) => b.id === paidId);
    expect(row).toBeTruthy();
    expect(row.status).toBe('PAID');
    expect(row.customer).toEqual({ id: userId, fullName: 'Admin Bookings Test', phone: expect.any(String) });
    expect(row.product.name).toBe(productName);
    expect(row.city).toEqual({ id: cityId, name: cityName });
    expect(typeof row.plan.name).toBe('string');
    expect(row.latestPayment).toMatchObject({ kind: 'DEPOSIT', status: 'SUCCESS' });
    expect(row.subscription).toMatchObject({ id: subscriptionId, status: 'ACTIVE' });
    expect(row.installJob).toMatchObject({ id: jobId, status: 'SCHEDULED', technician: null });

    // The pending one has no payment, subscription or job yet.
    const pending = r.body.data.find((b: { id: string }) => b.id === pendingId);
    expect(pending).toMatchObject({ status: 'PENDING_PAY', latestPayment: null, subscription: null, installJob: null });

    // Newest first: the paid booking was created after the pending one.
    const ids = r.body.data.map((b: { id: string }) => b.id);
    expect(ids.indexOf(paidId)).toBeLessThan(ids.indexOf(pendingId));
    expect(r.body.meta).toMatchObject({ page: 1, perPage: 100 });
    expect(r.body.meta.total).toBeGreaterThanOrEqual(2);
    expect(r.body.meta.counts.PAID).toBeGreaterThanOrEqual(1);
    expect(r.body.meta.counts.PENDING_PAY).toBeGreaterThanOrEqual(1);
  });

  it('shows the technician once the install job is assigned', async () => {
    await prisma.job.update({ where: { id: jobId }, data: { technicianId: techId } });
    try {
      const r = await list(`?status=PAID&cityId=${cityId}&perPage=100`);
      const row = r.body.data.find((b: { id: string }) => b.id === paidId);
      expect(row.installJob.technician).toEqual({ id: techId, employeeCode: techCode, fullName: 'Admin Bookings Tech' });
    } finally {
      await prisma.job.update({ where: { id: jobId }, data: { technicianId: null } });
    }
  });

  it('filters by status', async () => {
    const r = await list(`?status=PENDING_PAY&cityId=${cityId}&perPage=100`);
    expect(r.status).toBe(200);
    expect(r.body.data.every((b: { status: string }) => b.status === 'PENDING_PAY')).toBe(true);
    const ids = r.body.data.map((b: { id: string }) => b.id);
    expect(ids).toContain(pendingId);
    expect(ids).not.toContain(paidId);
  });

  it('pages and rejects bad query values', async () => {
    const r = await list('?perPage=1');
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.meta.perPage).toBe(1);
    expect((await list('?status=SHIPPED')).status).toBe(400);
    expect((await list('?perPage=1000')).status).toBe(400);
  });

  it('refuses a customer token and no token', async () => {
    expect((await list('', customerToken)).status).toBe(403);
    expect((await list('', null)).status).toBe(401);
  });

  it('never returns a device token', async () => {
    const r = await list(`?cityId=${cityId}&perPage=100`);
    expect(r.status).toBe(200);
    const raw = JSON.stringify(r.body);
    expect(raw).not.toContain(deviceToken);
    expect(raw).not.toContain('deviceToken');
  });
});
