// A customer sees who their technician is and how to reach them, never the
// employee record (salary, bank, ID-number hashes, address, emergency
// contact) or the technician's login row (core/technician-public.ts).

import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';
import { prisma } from '../src/core/prisma';
import { signAccessToken } from '../src/core/auth';

const app = buildApp();
const SECRET_FIELDS = [
  'aadhaarHash', 'panHash', 'bankAccountHash', 'bankAccountLast4', 'bankIfsc', 'bankName',
  'monthlySalaryPaise', 'addressLine1', 'addressPincode', 'emergencyContactName',
  'emergencyContactPhone', 'passwordHash', 'employeeCode',
];

let customerId = '';
let customerToken = '';
let techUserId = '';
let technicianId = '';
let bookingId = '';
let ticketId = '';

beforeAll(async () => {
  const [product, plan, city] = await Promise.all([
    prisma.product.findFirstOrThrow(),
    prisma.plan.findFirstOrThrow(),
    prisma.city.findFirstOrThrow(),
  ]);
  const customer = await prisma.user.create({
    data: { kind: 'CUSTOMER', phone: `+9197${crypto.randomInt(10_000_000, 99_999_999)}`, fullName: 'Privacy Test' },
  });
  customerId = customer.id;
  customerToken = signAccessToken({ sub: customer.id, kind: 'CUSTOMER' });

  const techUser = await prisma.user.create({
    data: {
      kind: 'TECHNICIAN',
      phone: `+9197${crypto.randomInt(10_000_000, 99_999_999)}`,
      fullName: 'Privacy Tech',
      passwordHash: 'not-for-customers',
    },
  });
  techUserId = techUser.id;
  const tech = await prisma.technician.create({
    data: {
      userId: techUser.id,
      employeeCode: `PV-${crypto.randomBytes(4).toString('hex')}`,
      zone: city.name,
      aadhaarHash: 'aadhaar-hash',
      panHash: 'pan-hash',
      bankAccountHash: 'bank-hash',
      bankAccountLast4: '1234',
      bankIfsc: 'TEST0000001',
      bankName: 'Test Bank',
      monthlySalaryPaise: 2_500_000,
      addressLine1: '1 Secret Street',
      addressPincode: '411001',
      emergencyContactName: 'Someone',
      emergencyContactPhone: '+919000000000',
    },
  });
  technicianId = tech.id;

  const booking = await prisma.booking.create({
    data: { userId: customer.id, productId: product.id, planId: plan.id, cityId: city.id, depositPaise: 0, firstPaymentPaise: 100, status: 'PAID' },
  });
  bookingId = booking.id;
  await prisma.job.create({
    data: { bookingId, technicianId, type: 'INSTALL', status: 'SCHEDULED', scheduledFor: new Date(Date.now() + 86400000) },
  });
  const ticket = await prisma.ticket.create({
    data: { userId: customer.id, technicianId, category: 'REPAIR', description: 'Privacy test' },
  });
  ticketId = ticket.id;
});

afterAll(async () => {
  await prisma.job.deleteMany({ where: { technicianId } });
  await prisma.ticket.deleteMany({ where: { userId: customerId } });
  await prisma.booking.deleteMany({ where: { userId: customerId } });
  await prisma.technician.deleteMany({ where: { id: technicianId } });
  await prisma.user.deleteMany({ where: { id: { in: [customerId, techUserId] } } });
  await prisma.$disconnect();
});

function expectNoSecrets(body: unknown) {
  const text = JSON.stringify(body);
  for (const field of SECRET_FIELDS) expect(text).not.toContain(`"${field}"`);
  expect(text).not.toContain('not-for-customers');
}

describe("Customers see only their technician's name and phone", () => {
  it('GET /bookings/:id', async () => {
    const r = await request(app).get(`/api/v1/bookings/${bookingId}`).set('Authorization', `Bearer ${customerToken}`);
    expect(r.status).toBe(200);
    expect(r.body.data.jobs[0].technician.user.fullName).toBe('Privacy Tech');
    expectNoSecrets(r.body);
  });

  it('GET /tickets/me', async () => {
    const r = await request(app).get('/api/v1/tickets/me').set('Authorization', `Bearer ${customerToken}`);
    expect(r.status).toBe(200);
    const t = r.body.data.find((x: { id: string }) => x.id === ticketId);
    expect(t.technician.user.fullName).toBe('Privacy Tech');
    expectNoSecrets(r.body);
  });

  it('GET /tickets/:id', async () => {
    const r = await request(app).get(`/api/v1/tickets/${ticketId}`).set('Authorization', `Bearer ${customerToken}`);
    expect(r.status).toBe(200);
    expect(r.body.data.technician.user.fullName).toBe('Privacy Tech');
    expectNoSecrets(r.body);
  });
});
