import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';
import { prisma } from '../src/core/prisma';

const app = buildApp();

describe('Health', () => {
  it('GET /health returns ok', async () => {
    const r = await request(app).get('/health');
    expect(r.status).toBe(200);
    expect(r.body.data.ok).toBe(true);
  });
});

describe('Catalog', () => {
  it('GET /api/v1/cities returns serviceable cities', async () => {
    const r = await request(app).get('/api/v1/cities');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
    expect(r.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/v1/products returns active products', async () => {
    const r = await request(app).get('/api/v1/products');
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/plans returns plans sorted by duration', async () => {
    const r = await request(app).get('/api/v1/plans');
    expect(r.status).toBe(200);
    const days = r.body.data.map((p: { durationDays: number }) => p.durationDays);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
  });
});

describe('Auth — OTP', () => {
  const phone = '+919999000077';
  let otp: string;
  let accessToken: string;

  it('requests OTP', async () => {
    const r = await request(app).post('/api/v1/auth/otp/request').send({ phone });
    expect(r.status).toBe(200);
    expect(r.body.data.devOtp).toMatch(/^\d{6}$/);
    otp = r.body.data.devOtp;
  });

  it('verifies OTP and returns tokens', async () => {
    const r = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ phone, otp, fullName: 'Test User' });
    expect(r.status).toBe(200);
    expect(r.body.data.accessToken).toBeTruthy();
    accessToken = r.body.data.accessToken;
  });

  it('GET /me with bearer returns user', async () => {
    const r = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(r.status).toBe(200);
    expect(r.body.data.phone).toBe(phone);
  });

  it('rejects invalid OTP', async () => {
    const r = await request(app).post('/api/v1/auth/otp/verify').send({ phone, otp: '000000' });
    expect(r.status).toBe(401);
  });
});

describe('Admin login', () => {
  it('logs in seeded admin', async () => {
    const r = await request(app)
      .post('/api/v1/auth/admin/login')
      .send({ email: 'admin@smartro.in', password: process.env.SEED_ADMIN_PASSWORD });
    expect(r.status).toBe(200);
    expect(r.body.data.user.kind).toBe('ADMIN');
  });

  it('rejects bad password', async () => {
    const r = await request(app)
      .post('/api/v1/auth/admin/login')
      .send({ email: 'admin@smartro.in', password: 'wrong' });
    expect(r.status).toBe(401);
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
