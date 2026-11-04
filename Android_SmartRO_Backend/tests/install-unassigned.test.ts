// Install slot with no free technician: the paid customer still gets the slot,
// the INSTALL job is saved unassigned, and an admin assigns a technician later.

import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';
import { prisma } from '../src/core/prisma';
import { signAccessToken } from '../src/core/auth';

const app = buildApp();

let adminToken = '';
let userId = '';
let token = '';
const techUserIds: string[] = [];
let activeTechId = '';
let onLeaveTechId = '';
const bookingIds: string[] = [];
let unassignedJobId = '';

const rnd = () => crypto.randomBytes(6).toString('hex');
const phone = () => `+9193${crypto.randomInt(10_000_000, 99_999_999)}`;

async function makeTech(status: string) {
  const u = await prisma.user.create({ data: { kind: 'TECHNICIAN', phone: phone(), fullName: `Unassigned Test ${status}` } });
  techUserIds.push(u.id);
  const t = await prisma.technician.create({
    data: { userId: u.id, employeeCode: `TST-${rnd()}`, zone: 'TEST', status, isActive: status === 'ACTIVE' },
  });
  return t.id;
}

async function paidBooking() {
  const price = await prisma.planCityPrice.findFirstOrThrow({ where: { plan: { isActive: true } } });
  const b = await prisma.booking.create({
    data: {
      userId,
      productId: price.productId,
      planId: price.planId,
      cityId: price.cityId,
      depositPaise: price.depositPaise,
      firstPaymentPaise: price.monthlyPricePaise,
      agreementSignedAt: new Date(),
      status: 'PAID',
    },
  });
  bookingIds.push(b.id);
  return b.id;
}

async function firstSlot(bookingId: string): Promise<string> {
  const r = await request(app).get(`/api/v1/bookings/${bookingId}/install-slots`).set('Authorization', `Bearer ${token}`);
  expect(r.status).toBe(200);
  return r.body.data[0].start;
}

const bookSlot = (bookingId: string, start: string) =>
  request(app).post(`/api/v1/bookings/${bookingId}/install-slot`).set('Authorization', `Bearer ${token}`).send({ start });

const assign = (jobId: string, technicianId: string, bearer = adminToken) =>
  request(app).patch(`/api/v1/admin/jobs/${jobId}`).set('Authorization', `Bearer ${bearer}`).send({ technicianId });

beforeAll(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { kind: 'ADMIN' } });
  adminToken = signAccessToken({ sub: admin.id, kind: 'ADMIN' });
  const user = await prisma.user.create({ data: { kind: 'CUSTOMER', phone: phone(), fullName: 'Unassigned Install Test' } });
  userId = user.id;
  token = signAccessToken({ sub: user.id, kind: 'CUSTOMER' });
  activeTechId = await makeTech('ACTIVE');
  onLeaveTechId = await makeTech('ON_LEAVE');
});

afterAll(async () => {
  const jobs = await prisma.job.findMany({ where: { bookingId: { in: bookingIds } }, select: { id: true } });
  await prisma.auditLog.deleteMany({ where: { entity: 'Job', entityId: { in: jobs.map((j) => j.id) } } });
  await prisma.job.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.notification.deleteMany({ where: { userId } });
  await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  await prisma.technician.deleteMany({ where: { id: { in: [activeTechId, onLeaveTechId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, ...techUserIds] } } });
});

describe('POST /bookings/:id/install-slot', () => {
  it('saves the slot with an unassigned job when no technician is active', async () => {
    const bookingId = await paidBooking();
    const start = await firstSlot(bookingId);
    // Other tests share this database and keep active technicians in it, so
    // the "nobody active" lookup is faked rather than emptying the table.
    const realFindMany = prisma.technician.findMany;
    const spy = vi.spyOn(prisma.technician, 'findMany').mockResolvedValue([] as never);
    let r;
    try {
      r = await bookSlot(bookingId, start);
    } finally {
      // mockRestore can't put back a Prisma model method; pass calls through instead.
      spy.mockImplementation(realFindMany);
    }
    expect(spy).toHaveBeenCalledTimes(2); // city zone match, then any active technician
    expect(r.status).toBe(200);
    expect(r.body.data.technicianId).toBeNull();
    expect(r.body.data.job.technicianId).toBeNull();
    expect(r.body.data.job.status).toBe('SCHEDULED');
    expect(new Date(r.body.data.booking.installationSlot).toISOString()).toBe(start);

    const job = await prisma.job.findUniqueOrThrow({ where: { id: r.body.data.job.id } });
    expect(job.technicianId).toBeNull();
    expect(job.type).toBe('INSTALL');
    expect(job.bookingId).toBe(bookingId);
    unassignedJobId = job.id;

    // The customer's booking view copes with the missing technician.
    const view = await request(app).get(`/api/v1/bookings/${bookingId}`).set('Authorization', `Bearer ${token}`);
    expect(view.status).toBe(200);
    expect(view.body.data.jobs[0].technician).toBeNull();
  });

  it('still auto-assigns an active technician when there is one', async () => {
    const bookingId = await paidBooking();
    const r = await bookSlot(bookingId, await firstSlot(bookingId));
    expect(r.status).toBe(200);
    expect(typeof r.body.data.technicianId).toBe('string');
    expect(r.body.data.job.technicianId).toBe(r.body.data.technicianId);
    const tech = await prisma.technician.findUniqueOrThrow({ where: { id: r.body.data.technicianId } });
    expect(tech.status).toBe('ACTIVE');
  });
});

describe('Admin: unassigned jobs', () => {
  it('lists the job as unassigned and counts it on the dashboard', async () => {
    const r = await request(app).get('/api/v1/admin/jobs?view=unassigned').set('Authorization', `Bearer ${adminToken}`);
    expect(r.status).toBe(200);
    const row = r.body.data.find((j: { id: string }) => j.id === unassignedJobId);
    expect(row).toBeTruthy();
    expect(row.technician).toBeNull();
    expect(row.booking.user.id).toBe(userId);
    expect(r.body.data.every((j: { technicianId: string | null }) => j.technicianId === null)).toBe(true);

    const stats = await request(app).get('/api/v1/admin/dashboard/stats').set('Authorization', `Bearer ${adminToken}`);
    expect(stats.status).toBe(200);
    expect(stats.body.data.unassignedJobs).toBeGreaterThanOrEqual(1);
  });

  it('refuses a technician who is not active, an unknown one, and non-admins', async () => {
    expect((await assign(unassignedJobId, onLeaveTechId)).status).toBe(400);
    expect((await assign(unassignedJobId, 'no-such-technician')).status).toBe(400);
    expect((await assign(unassignedJobId, activeTechId, token)).status).toBe(403);
    expect((await assign('no-such-job', activeTechId)).status).toBe(404);
    const job = await prisma.job.findUniqueOrThrow({ where: { id: unassignedJobId } });
    expect(job.technicianId).toBeNull();
  });

  it('assigns a technician and writes an audit row', async () => {
    const r = await assign(unassignedJobId, activeTechId);
    expect(r.status).toBe(200);
    expect(r.body.data.technicianId).toBe(activeTechId);
    expect(r.body.data.technician.id).toBe(activeTechId);

    const job = await prisma.job.findUniqueOrThrow({ where: { id: unassignedJobId } });
    expect(job.technicianId).toBe(activeTechId);

    const log = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'JOB_ASSIGN', entity: 'Job', entityId: unassignedJobId },
      orderBy: { createdAt: 'desc' },
    });
    expect(JSON.parse(log.before!)).toEqual({ technicianId: null });
    expect(JSON.parse(log.after!)).toEqual({ technicianId: activeTechId });

    const list = await request(app).get('/api/v1/admin/jobs?view=unassigned').set('Authorization', `Bearer ${adminToken}`);
    expect(list.body.data.some((j: { id: string }) => j.id === unassignedJobId)).toBe(false);
  });

  it('will not change the technician on a finished job', async () => {
    await prisma.job.update({ where: { id: unassignedJobId }, data: { status: 'DONE', completedAt: new Date() } });
    const r = await assign(unassignedJobId, activeTechId);
    expect(r.status).toBe(400);
  });
});
