// GET /devices/me/health and /devices/me/readings read the plan whose purifier
// is at the customer's home: the newest plan with one paired, the same plan
// /me/local-access reads. A newer plan without a purifier (every booking
// before its installation) used to hide it, so the device dashboard said
// "No device installed yet" right under a working water switch.

import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Prisma } from '@prisma/client';
import { buildApp } from '../src/app';
import { prisma } from '../src/core/prisma';
import { signAccessToken } from '../src/core/auth';

const app = buildApp();
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const rnd = () => crypto.randomBytes(5).toString('hex').toUpperCase();

const userIds: string[] = [];
const deviceIds: string[] = [];
let productId = '';
let planId = '';
let planName = '';
let cityId = '';

const me = (path: 'health' | 'readings' | 'local-access', jwt: string, query: Record<string, string> = {}) =>
  request(app).get(`/api/v1/devices/me/${path}`).query(query).set('Authorization', `Bearer ${jwt}`);

async function customer(fullName: string) {
  const user = await prisma.user.create({
    data: { kind: 'CUSTOMER', phone: `+9192${crypto.randomInt(10_000_000, 99_999_999)}`, fullName },
  });
  userIds.push(user.id);
  return { userId: user.id, jwt: signAccessToken({ sub: user.id, kind: 'CUSTOMER' }) };
}

async function purifier(over: Partial<Prisma.DeviceUncheckedCreateInput> = {}) {
  const tag = rnd();
  const device = await prisma.device.create({
    data: {
      serial: `SR-DH-${tag}`,
      qr: `QR-DH-${tag}`,
      productId,
      status: 'INSTALLED',
      deviceToken: crypto.randomBytes(24).toString('base64url'),
      ...over,
    },
  });
  deviceIds.push(device.id);
  return device;
}

/** A plan booked `daysAgo` days ago, with its purifier paired or (null) not installed yet. */
async function plan(userId: string, daysAgo: number, deviceId: string | null, status = 'ACTIVE') {
  const createdAt = new Date(Date.now() - daysAgo * DAY);
  const booking = await prisma.booking.create({
    data: {
      userId,
      productId,
      planId,
      cityId,
      depositPaise: 0,
      firstPaymentPaise: 0,
      status: deviceId ? 'INSTALLED' : 'PAID',
      createdAt,
    },
  });
  return prisma.subscription.create({
    data: {
      userId,
      bookingId: booking.id,
      productId,
      planId,
      deviceId,
      status,
      createdAt,
      startedAt: createdAt,
      expiresAt: new Date(Date.now() + 20 * DAY),
      lockInUntil: new Date(Date.now() + 20 * DAY),
    },
  });
}

const reading = (deviceId: string, kind: string, minsAgo: number, data: { tdsPpm?: number; usageLitres?: number } = {}) =>
  prisma.deviceReading.create({ data: { deviceId, kind, createdAt: new Date(Date.now() - minsAgo * MIN), ...data } });

beforeAll(async () => {
  const [product, p, city] = await Promise.all([
    prisma.product.findFirstOrThrow(),
    prisma.plan.findFirstOrThrow(),
    prisma.city.findFirstOrThrow(),
  ]);
  productId = product.id;
  planId = p.id;
  planName = p.name;
  cityId = city.id;
});

afterAll(async () => {
  await prisma.deviceReading.deleteMany({ where: { deviceId: { in: deviceIds } } });
  await prisma.subscription.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.booking.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.device.deleteMany({ where: { id: { in: deviceIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe('GET /devices/me/health and /me/readings', () => {
  it('a newer plan without a purifier does not hide the one at home', async () => {
    const { userId, jwt } = await customer('Health Two Plans');
    const home = await purifier({ lastSeenAt: new Date(), lastTdsPpm: 42, filterLifePct: 80, usageLitresTotal: 120 });
    const installed = await plan(userId, 30, home.id);
    await plan(userId, 1, null); // booked yesterday, not installed yet

    const tdsOld = await reading(home.id, 'TDS', 120, { tdsPpm: 40 });
    const tdsNew = await reading(home.id, 'TDS', 60, { tdsPpm: 42 });
    const usage = await reading(home.id, 'USAGE', 30, { usageLitres: 12 });

    const health = await me('health', jwt);
    expect(health.status).toBe(200);
    expect(health.body.data).toMatchObject({
      serial: home.serial,
      isOnline: true,
      tdsPpm: 42,
      filterLifePct: 80,
      usageLitresTotal: 120,
      subscriptionStatus: 'ACTIVE',
      expiresAt: installed.expiresAt.toISOString(),
      planName,
    });

    const all = await me('readings', jwt);
    expect(all.status).toBe(200);
    expect(all.body.data.map((r: { id: string }) => r.id)).toEqual([usage.id, tdsNew.id, tdsOld.id]);
    const tds = await me('readings', jwt, { kind: 'TDS' });
    expect(tds.body.data.map((r: { tdsPpm: number }) => r.tdsPpm)).toEqual([42, 40]);

    // The water switch on the same screen talks to the same purifier.
    expect((await me('local-access', jwt)).body.data.serial).toBe(home.serial);
  });

  it('reads the plan /me/local-access reads: the newest with a purifier, in any status', async () => {
    const { userId, jwt } = await customer('Health Two Purifiers');
    const first = await purifier();
    const second = await purifier();
    await plan(userId, 60, first.id);
    await plan(userId, 20, second.id, 'SUSPENDED');
    await plan(userId, 1, null);
    await reading(first.id, 'TDS', 10, { tdsPpm: 300 });
    const own = await reading(second.id, 'TDS', 20, { tdsPpm: 55 });

    const health = await me('health', jwt);
    expect(health.body.data).toMatchObject({ serial: second.serial, subscriptionStatus: 'SUSPENDED' });
    expect((await me('readings', jwt)).body.data.map((r: { id: string }) => r.id)).toEqual([own.id]);
    expect((await me('local-access', jwt)).body.data.serial).toBe(second.serial);
  });

  it('with no purifier anywhere: health is null and readings are empty', async () => {
    const awaiting = await customer('Health Awaiting Install');
    await plan(awaiting.userId, 1, null);
    const noPlan = await customer('Health No Plan');

    for (const { jwt } of [awaiting, noPlan]) {
      const health = await me('health', jwt);
      expect(health.status).toBe(200);
      expect(health.body).toEqual({ data: null });
      const readings = await me('readings', jwt);
      expect(readings.status).toBe(200);
      expect(readings.body).toEqual({ data: [] });
      expect((await me('local-access', jwt)).body).toEqual({ data: null });
    }
  });
});
