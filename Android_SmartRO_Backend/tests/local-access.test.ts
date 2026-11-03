// Local Wi-Fi control: the ESP32 reports its LAN address in the heartbeat, and
// the customer app fetches that address plus the command-signing key from
// GET /devices/me/local-access. The key is derived from the device token; the
// token itself never reaches the app.

import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';
import { prisma } from '../src/core/prisma';
import { signAccessToken } from '../src/core/auth';
import { localKeyFor } from '../src/core/device-token';

const app = buildApp();
const DAY = 86400000;
const rnd = () => crypto.randomBytes(5).toString('hex').toUpperCase();
const phone = () => `+9194${crypto.randomInt(10_000_000, 99_999_999)}`;

let adminToken = '';
const userIds: string[] = [];
const deviceIds: string[] = [];

// Paired customer: ACTIVE plan, device with a token.
let pairedToken = '';
let serial = '';
let deviceToken = '';
// Customer with a plan but no device yet.
let unpairedToken = '';
// Customer whose plan has expired and whose device has no token.
let lapsedToken = '';
let bareSerial = '';

const localAccess = (jwt?: string) => {
  const r = request(app).get('/api/v1/devices/me/local-access');
  return jwt ? r.set('Authorization', `Bearer ${jwt}`) : r;
};
const heartbeat = (body: object) =>
  request(app).post(`/api/v1/devices/${serial}/heartbeat`).set('X-Device-Token', deviceToken).send(body);

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { kind: 'ADMIN' } });
  adminToken = signAccessToken({ sub: admin.id, kind: 'ADMIN' });

  const [product, plan, city] = await Promise.all([
    prisma.product.findFirstOrThrow(),
    prisma.plan.findFirstOrThrow(),
    prisma.city.findFirstOrThrow(),
  ]);

  async function customerWithPlan(fullName: string, status: string, expiresAt: Date, deviceId: string | null) {
    const user = await prisma.user.create({ data: { kind: 'CUSTOMER', phone: phone(), fullName } });
    userIds.push(user.id);
    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        productId: product.id,
        planId: plan.id,
        cityId: city.id,
        depositPaise: 0,
        firstPaymentPaise: 0,
        status: 'INSTALLED',
      },
    });
    await prisma.subscription.create({
      data: {
        userId: user.id,
        bookingId: booking.id,
        productId: product.id,
        planId: plan.id,
        deviceId,
        status,
        expiresAt,
        lockInUntil: new Date(),
      },
    });
    return signAccessToken({ sub: user.id, kind: 'CUSTOMER' });
  }

  const tag = rnd();
  serial = `SR-LA-${tag}`;
  deviceToken = crypto.randomBytes(24).toString('base64url');
  const device = await prisma.device.create({
    data: { serial, qr: `QR-LA-${tag}`, productId: product.id, status: 'INSTALLED', deviceToken },
  });
  bareSerial = `SR-LA-${tag}-B`;
  const bare = await prisma.device.create({
    data: { serial: bareSerial, qr: `QR-LA-${tag}-B`, productId: product.id, status: 'INSTALLED' },
  });
  deviceIds.push(device.id, bare.id);

  pairedToken = await customerWithPlan('Local Access Paired', 'ACTIVE', new Date(Date.now() + 30 * DAY), device.id);
  unpairedToken = await customerWithPlan('Local Access Unpaired', 'ACTIVE', new Date(Date.now() + 30 * DAY), null);
  lapsedToken = await customerWithPlan('Local Access Lapsed', 'EXPIRED', new Date(Date.now() - 10 * DAY), bare.id);
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entity: 'Device', entityId: { in: deviceIds } } });
  await prisma.deviceReading.deleteMany({ where: { deviceId: { in: deviceIds } } });
  await prisma.ticket.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.subscription.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.booking.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.device.deleteMany({ where: { id: { in: deviceIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe('localKeyFor', () => {
  it('matches the contract test vector', () => {
    expect(localKeyFor('devtok-demo-priya-aquapure-7l')).toBe(
      '8ba08c6faf0f3d8d680f1fcf28be99fb015232bec893257c24a5c1496d251a14'
    );
  });

  it('is 64 lowercase hex and changes with the token', () => {
    const a = localKeyFor('token-a');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(localKeyFor('token-b')).not.toBe(a);
  });
});

describe('GET /devices/me/local-access', () => {
  it('needs a customer JWT', async () => {
    expect((await localAccess()).status).toBe(401);
    expect((await localAccess(adminToken)).status).toBe(403);
  });

  it('is null when no device is paired', async () => {
    const r = await localAccess(unpairedToken);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ data: null });
    expect(r.headers['cache-control']).toBe('no-store');
  });

  it('before any heartbeat: no IP, offline, but the key is there', async () => {
    const r = await localAccess(pairedToken);
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({
      serial,
      localIp: null,
      localKey: localKeyFor(deviceToken),
      lastHeartbeatAt: null,
      isOnline: false,
    });
  });

  it('works on a lapsed plan, with a null key when the device has no token', async () => {
    const r = await localAccess(lapsedToken);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ serial: bareSerial, localKey: null, localIp: null, isOnline: false });
  });

  it('gives the seeded demo customer the contract key for SR-AP-000101', async () => {
    const priya = await prisma.user.findUnique({ where: { phone: '+919876543210' } });
    const dev = await prisma.device.findUnique({ where: { serial: 'SR-AP-000101' } });
    if (!priya || dev?.deviceToken !== 'devtok-demo-priya-aquapure-7l') return; // seed not loaded
    const r = await localAccess(signAccessToken({ sub: priya.id, kind: 'CUSTOMER' }));
    expect(r.status).toBe(200);
    expect(r.body.data.serial).toBe('SR-AP-000101');
    expect(r.body.data.localKey).toBe('8ba08c6faf0f3d8d680f1fcf28be99fb015232bec893257c24a5c1496d251a14');
    expect(JSON.stringify(r.body)).not.toContain('devtok-demo-priya-aquapure-7l');
  });
});

describe('Heartbeat localIp', () => {
  it('stores the IPv4 address and returns it', async () => {
    const r = await heartbeat({ localIp: '192.168.1.50', firmwareVersion: '1.0.0' });
    expect(r.status).toBe(200);
    expect(r.body.data.localIp).toBe('192.168.1.50');
    expect((await prisma.device.findUniqueOrThrow({ where: { serial } })).localIp).toBe('192.168.1.50');
  });

  it('keeps the previous address when the field is missing', async () => {
    const r = await heartbeat({ firmwareVersion: '1.0.1' });
    expect(r.status).toBe(200);
    expect(r.body.data.localIp).toBe('192.168.1.50');
  });

  it('rejects anything that is not a dotted IPv4 address', async () => {
    for (const localIp of ['192.168.1.300', 'fe80::1', '192.168.1', 'smartro.local', 3232235826]) {
      const r = await heartbeat({ localIp });
      expect(r.status, String(localIp)).toBe(400);
    }
    expect((await prisma.device.findUniqueOrThrow({ where: { serial } })).localIp).toBe('192.168.1.50');
  });

  it('local-access then carries the IP and shows the device online, without the token', async () => {
    const r = await localAccess(pairedToken);
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body.data).toMatchObject({
      serial,
      localIp: '192.168.1.50',
      localKey: localKeyFor(deviceToken),
      isOnline: true,
    });
    expect(new Date(r.body.data.lastHeartbeatAt).getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(JSON.stringify(r.body)).not.toContain(deviceToken);
    expect(JSON.stringify(r.body)).not.toContain('deviceToken');
  });

  it('shows the device offline after 90 minutes without a heartbeat', async () => {
    await prisma.device.update({
      where: { serial },
      data: { lastHeartbeatAt: new Date(Date.now() - 91 * 60 * 1000) },
    });
    const r = await localAccess(pairedToken);
    expect(r.body.data).toMatchObject({ localIp: '192.168.1.50', isOnline: false });
  });

  it('a re-issued device token changes the key', async () => {
    const issued = await request(app)
      .post(`/api/v1/devices/admin/${serial}/issue-token`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(issued.status).toBe(200);
    const fresh = issued.body.data.token as string;
    const r = await localAccess(pairedToken);
    expect(r.body.data.localKey).toBe(localKeyFor(fresh));
    expect(r.body.data.localKey).not.toBe(localKeyFor(deviceToken));
    deviceToken = fresh;
  });
});
