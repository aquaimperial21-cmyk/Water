// The marketing website's enquiry forms post to POST /inquiries/website
// (modules/inquiry.ts): no login, honeypot, rate limits per client address
// and per phone. Each enquiry is an Inquiry row the admin console lists, plus
// an in-app notification for every active admin. The app's POST /inquiries
// is unchanged.

import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';
import { prisma } from '../src/core/prisma';
import { signAccessToken } from '../src/core/auth';
import { normalizeIndianMobile } from '../src/modules/inquiry';

const app = buildApp();
const tag = crypto.randomBytes(4).toString('hex');

const phones: string[] = []; // normalized, for cleanup
/** A fresh 10-digit mobile; `+91` + it is what the server stores. */
const newMobile = () => {
  const m = `98${crypto.randomInt(10_000_000, 99_999_999)}`;
  phones.push(`+91${m}`);
  return m;
};
const newIp = () => `10.77.${crypto.randomInt(0, 255)}.${crypto.randomInt(1, 254)}`;
const postWebsite = (body: object, ip = newIp()) =>
  request(app).post('/api/v1/inquiries/website').set('X-Forwarded-For', ip).send(body);

let cityId = '';
let cityName = '';
let productId = '';
let productSlug = '';
let inactiveSlug = '';
const productIds: string[] = [];
let createdAdminId: string | null = null;
let adminToken = '';

beforeAll(async () => {
  cityName = `Enquirytown ${tag}`;
  cityId = (await prisma.city.create({ data: { name: cityName, state: 'Maharashtra' } })).id;
  const product = (slug: string, isActive: boolean) =>
    prisma.product.create({
      data: {
        slug,
        name: `Enquiry Purifier ${slug}`,
        kind: 'HOME',
        capacityLitres: 8,
        technology: 'RO+UV',
        mounting: 'WALL',
        description: 'website enquiry test',
        isActive,
      },
    });
  productSlug = `enquiry-test-${tag}`;
  inactiveSlug = `enquiry-old-${tag}`;
  const p = await product(productSlug, true);
  productId = p.id;
  productIds.push(p.id, (await product(inactiveSlug, false)).id);

  // Notifications go to every active admin; make sure there is one.
  let admin = await prisma.user.findFirst({ where: { kind: 'ADMIN', status: 'ACTIVE' } });
  if (!admin) {
    admin = await prisma.user.create({
      data: { kind: 'ADMIN', phone: `+9170${crypto.randomInt(10_000_000, 99_999_999)}`, fullName: 'Enquiry Admin' },
    });
    createdAdminId = admin.id;
  }
  adminToken = signAccessToken({ sub: admin.id, kind: 'ADMIN' });
});

afterAll(async () => {
  await prisma.notification.deleteMany({
    where: { title: 'New website enquiry', OR: phones.map((p) => ({ body: { contains: p } })) },
  });
  await prisma.inquiry.deleteMany({ where: { phone: { in: phones } } }); // events cascade
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.city.deleteMany({ where: { id: cityId } });
  if (createdAdminId) await prisma.user.delete({ where: { id: createdAdminId } });
  await prisma.$disconnect();
});

describe('normalizeIndianMobile', () => {
  it('accepts 10 digits starting 6-9, with +91 / 91 / 0, spaces and dashes', () => {
    for (const v of ['9876543210', '+919876543210', '+91 98765 43210', '91-98765-43210', '098765 43210', ' 98765-43210 ']) {
      expect(normalizeIndianMobile(v)).toBe('+919876543210');
    }
    expect(normalizeIndianMobile('6000000000')).toBe('+916000000000');
  });

  it('refuses anything else', () => {
    for (const v of ['5876543210', '987654321', '98765432101', '+92 9876543210', '0091 9876543210', '(987) 654-3210', 'abc', '']) {
      expect(normalizeIndianMobile(v)).toBeNull();
    }
  });
});

describe('POST /inquiries/website', () => {
  it('stores a contact-form enquiry and links the city and product', async () => {
    const mobile = newMobile();
    const r = await postWebsite({
      form: 'contact',
      name: '  Asha Patil ',
      phone: `+91 ${mobile.slice(0, 5)}-${mobile.slice(5)}`,
      email: 'asha@example.com',
      city: cityName.toUpperCase(),
      product: productSlug.toUpperCase(),
      heardFrom: 'Instagram',
      message: 'Need a purifier for a family of 4',
      extra: 'ignored',
    });
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ data: { ok: true } });

    const rows = await prisma.inquiry.findMany({ where: { phone: `+91${mobile}` }, include: { events: true } });
    expect(rows).toHaveLength(1);
    const inq = rows[0];
    expect(inq).toMatchObject({
      name: 'Asha Patil',
      phone: `+91${mobile}`,
      pincode: null,
      email: 'asha@example.com',
      source: 'WEBSITE_CONTACT',
      cityId,
      cityName: cityName.toUpperCase(),
      productId,
      productName: productSlug.toUpperCase(),
      heardFrom: 'Instagram',
      notes: 'Need a purifier for a family of 4',
      status: 'NEW',
      userId: null,
    });
    expect(inq.events).toHaveLength(1);
    expect(inq.events[0].type).toBe('CREATED');
    expect(JSON.parse(inq.events[0].payload)).toEqual({ source: 'WEBSITE_CONTACT' });

    // The admin console reads the new fields from the list and the detail.
    const list = await request(app).get('/api/v1/inquiries').set('Authorization', `Bearer ${adminToken}`).query({ perPage: 100 });
    expect(list.status).toBe(200);
    const listed = (list.body.data as Array<Record<string, unknown>>).find((i) => i.id === inq.id);
    expect(listed).toMatchObject({ source: 'WEBSITE_CONTACT', cityName: cityName.toUpperCase(), email: 'asha@example.com', heardFrom: 'Instagram', pincode: null });
    const detail = await request(app).get(`/api/v1/inquiries/${inq.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({ source: 'WEBSITE_CONTACT', productName: productSlug.toUpperCase(), notes: 'Need a purifier for a family of 4' });
  });

  it('notifies every active admin in the app', async () => {
    const mobile = newMobile();
    expect((await postWebsite({ form: 'contact', name: 'Notify Me', phone: mobile, city: 'Pune' })).status).toBe(201);
    const admins = await prisma.user.findMany({ where: { kind: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
    const rows = await prisma.notification.findMany({ where: { title: 'New website enquiry', body: { contains: `+91${mobile}` } } });
    expect(rows.map((n) => n.userId).sort()).toEqual(admins.map((a) => a.id).sort());
    for (const n of rows) {
      expect(n).toMatchObject({ channel: 'INAPP', status: 'SENT', body: `Notify Me · Pune · +91${mobile}`, pushedAt: null });
      expect(n.sentAt).toBeInstanceOf(Date);
    }
  });

  it('stores a pop-up enquiry with only name, phone and city', async () => {
    const mobile = newMobile();
    const r = await postWebsite({ form: 'popup', name: 'Ravi', phone: `0${mobile}`, city: 'Nowhere Nagar', email: '' });
    expect(r.status).toBe(201);
    const inq = await prisma.inquiry.findFirstOrThrow({ where: { phone: `+91${mobile}` } });
    expect(inq).toMatchObject({
      source: 'WEBSITE_POPUP',
      cityName: 'Nowhere Nagar',
      cityId: null,
      email: null,
      productId: null,
      productName: null,
      heardFrom: null,
      notes: null,
      pincode: null,
    });
  });

  it('keeps the product text but links no inactive product; says when the city is missing', async () => {
    const mobile = newMobile();
    expect((await postWebsite({ form: 'popup', name: 'Old Model', phone: mobile, product: inactiveSlug })).status).toBe(201);
    const inq = await prisma.inquiry.findFirstOrThrow({ where: { phone: `+91${mobile}` } });
    expect(inq).toMatchObject({ productId: null, productName: inactiveSlug, cityName: null });
    const n = await prisma.notification.findFirstOrThrow({ where: { title: 'New website enquiry', body: { contains: `+91${mobile}` } } });
    expect(n.body).toBe(`Old Model · city not given · +91${mobile}`);
  });

  it('answers a filled honeypot with 201 and stores nothing', async () => {
    const mobile = newMobile();
    const r = await postWebsite({ form: 'contact', name: 'Bot', phone: mobile, website: 'http://spam.example' });
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ data: { ok: true } });
    expect(await prisma.inquiry.count({ where: { phone: `+91${mobile}` } })).toBe(0);
    expect(await prisma.notification.count({ where: { title: 'New website enquiry', body: { contains: `+91${mobile}` } } })).toBe(0);
  });

  it('refuses a bad phone, a missing name and other bad fields', async () => {
    const mobile = newMobile();
    const bad = [
      { form: 'contact', name: 'X', phone: '12345' },
      { form: 'contact', name: 'X', phone: `5${mobile.slice(1)}` },
      { form: 'contact', name: 'X', phone: `+1 ${mobile}` },
      { form: 'contact', name: 'X' },
      { form: 'contact', phone: mobile },
      { form: 'contact', name: '   ', phone: mobile },
      { form: 'contact', name: 'X'.repeat(121), phone: mobile },
      { form: 'contact', name: 'X', phone: mobile, email: 'not-an-email' },
      { form: 'contact', name: 'X', phone: mobile, message: 'm'.repeat(1001) },
      { form: 'chat', name: 'X', phone: mobile },
      { name: 'X', phone: mobile },
    ];
    for (const body of bad) {
      const r = await postWebsite(body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(r.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect(await prisma.inquiry.count({ where: { phone: `+91${mobile}` } })).toBe(0);
  });

  it('allows 3 enquiries per phone per hour', async () => {
    const mobile = newMobile();
    const codes: number[] = [];
    for (let i = 0; i < 4; i++) {
      codes.push((await postWebsite({ form: 'popup', name: `Repeat ${i}`, phone: mobile })).status);
    }
    expect(codes).toEqual([201, 201, 201, 429]);
    const r = await postWebsite({ form: 'popup', name: 'Again', phone: `+91${mobile}` });
    expect(r.status).toBe(429);
    expect(r.body).toEqual({
      error: { code: 'RATE_LIMITED', message: 'Too many enquiries. Please try again later or WhatsApp us.' },
    });
    expect(await prisma.inquiry.count({ where: { phone: `+91${mobile}` } })).toBe(3);
  });

  it('allows 20 enquiries per client address per 10 minutes', async () => {
    const ip = newIp();
    const codes: number[] = [];
    for (let i = 0; i < 21; i++) {
      codes.push((await postWebsite({ form: 'popup', name: `Same IP ${i}`, phone: newMobile() }, `${ip}, 172.16.0.1`)).status);
    }
    expect(codes).toEqual([...Array(20).fill(201), 429]);
    // Another address is not affected.
    expect((await postWebsite({ form: 'popup', name: 'Other IP', phone: newMobile() })).status).toBe(201);
  });
});

describe('POST /inquiries (app)', () => {
  it('still works, needs a pincode and records source APP', async () => {
    const mobile = newMobile();
    const r = await request(app)
      .post('/api/v1/inquiries')
      .send({ name: 'App Lead', phone: `+91${mobile}`, pincode: '411001', cityId, notes: 'from the app' });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ phone: `+91${mobile}`, pincode: '411001', source: 'APP', cityId, email: null });

    const missing = await request(app).post('/api/v1/inquiries').send({ name: 'App Lead', phone: `+91${mobile}` });
    expect(missing.status).toBe(400);
  });
});
