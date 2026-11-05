// Device tokens: no list or detail response carries one, the admin reveal
// route returns it and is audited, and issuing a new token cuts off the old.

import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';
import { prisma } from '../src/core/prisma';
import { signAccessToken } from '../src/core/auth';

const app = buildApp();
const rnd = () => crypto.randomBytes(5).toString('hex').toUpperCase();

let adminId = '';
let adminToken = '';
let customerId = '';
let customerToken = '';
let deviceId = '';
let serial = '';
let deviceToken = '';
let bareSerial = ''; // a device with no token yet
let bareDeviceId = '';
let ticketId = '';

const asAdmin = (path: string) => request(app).get(`/api/v1${path}`).set('Authorization', `Bearer ${adminToken}`);
const asCustomer = (path: string) => request(app).get(`/api/v1${path}`).set('Authorization', `Bearer ${customerToken}`);
const pollState = (token: string) => request(app).get(`/api/v1/devices/${serial}/state`).set('X-Device-Token', token);

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { kind: 'ADMIN' } });
  adminId = admin.id;
  adminToken = signAccessToken({ sub: admin.id, kind: 'ADMIN' });

  const [product, plan, city] = await Promise.all([
    prisma.product.findFirstOrThrow(),
    prisma.plan.findFirstOrThrow(),
    prisma.city.findFirstOrThrow(),
  ]);
  const customer = await prisma.user.create({
    data: { kind: 'CUSTOMER', phone: `+9195${crypto.randomInt(10_000_000, 99_999_999)}`, fullName: 'Token Test' },
  });
  customerId = customer.id;
  customerToken = signAccessToken({ sub: customer.id, kind: 'CUSTOMER' });

  const tag = rnd();
  serial = `SR-TT-${tag}`;
  deviceToken = crypto.randomBytes(24).toString('base64url');
  const device = await prisma.device.create({
    data: { serial, qr: `QR-TT-${tag}`, productId: product.id, status: 'INSTALLED', deviceToken },
  });
  deviceId = device.id;
  bareSerial = `SR-TT-${tag}-B`;
  const bare = await prisma.device.create({ data: { serial: bareSerial, qr: `QR-TT-${tag}-B`, productId: product.id } });
  bareDeviceId = bare.id;

  const booking = await prisma.booking.create({
    data: {
      userId: customer.id,
      productId: product.id,
      planId: plan.id,
      cityId: city.id,
      depositPaise: 0,
      firstPaymentPaise: 0,
      status: 'INSTALLED',
    },
  });
  const sub = await prisma.subscription.create({
    data: {
      userId: customer.id,
      bookingId: booking.id,
      productId: product.id,
      planId: plan.id,
      deviceId: device.id,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 30 * 86400000),
      lockInUntil: new Date(),
    },
  });
  const ticket = await prisma.ticket.create({
    data: { userId: customer.id, subscriptionId: sub.id, deviceId: device.id, category: 'REPAIR', description: 'Token test' },
  });
  ticketId = ticket.id;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entity: 'Device', entityId: { in: [deviceId, bareDeviceId] } } });
  await prisma.ticket.deleteMany({ where: { userId: customerId } });
  await prisma.subscription.deleteMany({ where: { userId: customerId } });
  await prisma.booking.deleteMany({ where: { userId: customerId } });
  await prisma.device.deleteMany({ where: { id: { in: [deviceId, bareDeviceId] } } });
  await prisma.notification.deleteMany({ where: { userId: customerId } });
  await prisma.user.delete({ where: { id: customerId } });
  await prisma.$disconnect();
});

describe('Responses never carry a device token', () => {
  it('GET /admin/devices sends hasToken instead', async () => {
    const r = await asAdmin('/admin/devices');
    expect(r.status).toBe(200);
    for (const d of r.body.data) {
      expect(d).not.toHaveProperty('deviceToken');
      expect(typeof d.hasToken).toBe('boolean');
    }
    expect(r.body.data.find((d: { serial: string }) => d.serial === serial).hasToken).toBe(true);
    expect(r.body.data.find((d: { serial: string }) => d.serial === bareSerial).hasToken).toBe(false);
  });

  it('GET /devices/admin/:serial/state sends hasToken instead', async () => {
    const r = await asAdmin(`/devices/admin/${serial}/state`);
    expect(r.status).toBe(200);
    expect(r.body.data).not.toHaveProperty('deviceToken');
    expect(r.body.data).toMatchObject({ serial, hasToken: true, isOnline: false });
  });

  it('customer subscription and ticket responses leave it out', async () => {
    for (const path of ['/subscriptions/me', '/tickets/me', `/tickets/${ticketId}`]) {
      const r = await asCustomer(path);
      expect(r.status, path).toBe(200);
      expect(JSON.stringify(r.body), path).not.toContain(deviceToken);
      expect(JSON.stringify(r.body), path).not.toContain('"deviceToken"');
    }
    const subs = await asCustomer('/subscriptions/me');
    expect(subs.body.data[0].device).toMatchObject({ serial, hasToken: true });
  });

  it('other admin responses that include a device leave it out', async () => {
    for (const path of [`/admin/customers/${customerId}`, '/subscriptions', '/tickets']) {
      const r = await asAdmin(path);
      expect(r.status, path).toBe(200);
      expect(JSON.stringify(r.body), path).not.toContain(deviceToken);
      expect(JSON.stringify(r.body), path).not.toContain('"deviceToken"');
    }
  });

  it('technician job responses leave it out', async () => {
    const tech = await prisma.technician.findFirst();
    if (!tech) return; // no seeded technician
    const job = await prisma.job.create({
      data: { ticketId, technicianId: tech.id, type: 'SERVICE', scheduledFor: new Date() },
    });
    try {
      const token = signAccessToken({ sub: tech.userId, kind: 'TECHNICIAN' });
      for (const path of ['/technician/jobs', '/technician/jobs/today', `/technician/jobs/${job.id}`]) {
        const r = await request(app).get(`/api/v1${path}`).set('Authorization', `Bearer ${token}`);
        expect(r.status, path).toBe(200);
        expect(JSON.stringify(r.body), path).not.toContain(deviceToken);
        expect(JSON.stringify(r.body), path).not.toContain('"deviceToken"');
      }
      const one = await request(app)
        .get(`/api/v1/technician/jobs/${job.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(one.body.data.ticket.device).toMatchObject({ serial, hasToken: true });
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });

  it('PATCH /admin/devices/:serial leaves it out', async () => {
    const r = await request(app)
      .patch(`/api/v1/admin/devices/${serial}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firmwareVersion: 'tt-1' });
    expect(r.status).toBe(200);
    expect(r.body.data).not.toHaveProperty('deviceToken');
    expect(r.body.data.hasToken).toBe(true);
  });
});

describe('GET /devices/admin/:serial/token', () => {
  it('returns the token and writes an audit row', async () => {
    const before = await prisma.auditLog.count({ where: { action: 'DEVICE_TOKEN_VIEW', entityId: deviceId } });
    const r = await asAdmin(`/devices/admin/${serial}/token`);
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({ serial, token: deviceToken });
    expect(r.headers['cache-control']).toBe('no-store');

    const rows = await prisma.auditLog.findMany({
      where: { action: 'DEVICE_TOKEN_VIEW', entityId: deviceId },
      orderBy: { createdAt: 'desc' },
    });
    expect(rows.length).toBe(before + 1);
    expect(rows[0]).toMatchObject({ actorUserId: adminId, entity: 'Device' });
    expect(JSON.parse(rows[0]!.after!)).toEqual({ serial });
  });

  it('is admin only', async () => {
    expect((await asCustomer(`/devices/admin/${serial}/token`)).status).toBe(403);
    const tech = signAccessToken({ sub: customerId, kind: 'TECHNICIAN' });
    const t = await request(app).get(`/api/v1/devices/admin/${serial}/token`).set('Authorization', `Bearer ${tech}`);
    expect(t.status).toBe(403);
    expect((await request(app).get(`/api/v1/devices/admin/${serial}/token`)).status).toBe(401);
  });

  it('404s for a missing device or one with no token, without auditing', async () => {
    expect((await asAdmin('/devices/admin/SR-NO-SUCH-DEVICE/token')).status).toBe(404);
    expect((await asAdmin(`/devices/admin/${bareSerial}/token`)).status).toBe(404);
    expect(await prisma.auditLog.count({ where: { action: 'DEVICE_TOKEN_VIEW', entityId: bareDeviceId } })).toBe(0);
  });
});

describe('POST /devices/admin/:serial/issue-token', () => {
  it('is admin only', async () => {
    const r = await request(app)
      .post(`/api/v1/devices/admin/${serial}/issue-token`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(r.status).toBe(403);
    expect((await pollState(deviceToken)).status).toBe(200);
  });

  it('replaces the token: the old one stops working, the new one works', async () => {
    expect((await pollState(deviceToken)).status).toBe(200);

    const r = await request(app)
      .post(`/api/v1/devices/admin/${serial}/issue-token`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    const fresh = r.body.data.token as string;
    expect(fresh).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(fresh).not.toBe(deviceToken);
    expect(r.body.data).toMatchObject({ id: deviceId, serial, deviceToken: fresh });

    expect((await pollState(deviceToken)).status).toBe(401);
    const ok = await pollState(fresh);
    expect(ok.status).toBe(200);
    expect(ok.body.data.allowFlow).toBe(true);

    const audit = await prisma.auditLog.findFirst({ where: { action: 'DEVICE_TOKEN_ISSUE', entityId: deviceId } });
    expect(audit).toMatchObject({ actorUserId: adminId, entity: 'Device' });
    expect(audit!.after).not.toContain(fresh);

    const shown = await asAdmin(`/devices/admin/${serial}/token`);
    expect(shown.body.data.token).toBe(fresh);
    deviceToken = fresh;
  });
});
