// Crash reports from the customer app (modules/app-errors.ts): accepted
// without login, logged as one [app-error] line, capped and rate-limited.

import crypto from 'node:crypto';
import { describe, it, expect, afterAll, vi } from 'vitest';
import request from 'supertest';
import { buildApp } from '../src/app';
import { prisma } from '../src/core/prisma';
import { signAccessToken } from '../src/core/auth';

const app = buildApp();
const post = (body: object, token?: string) => {
  const r = request(app).post('/api/v1/app-errors').set('X-Forwarded-For', `10.9.${crypto.randomInt(0, 255)}.${crypto.randomInt(1, 254)}`);
  return (token ? r.set('Authorization', `Bearer ${token}`) : r).send(body);
};

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /app-errors', () => {
  it('logs a report without login', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await post({ kind: 'render', fatal: true, message: 'TypeError: x is undefined', screen: 'MyPlan', appVersion: '0.1.0' });
    expect(r.status).toBe(202);
    const line = spy.mock.calls.map((c) => String(c[0])).find((l) => l.startsWith('[app-error]'));
    expect(line).toBeDefined();
    expect(line).toContain('"screen":"MyPlan"');
    expect(line).toContain('"user":null');
    spy.mockRestore();
  });

  it('adds the user id when a valid token is sent', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const token = signAccessToken({ sub: 'user-crash-test', kind: 'CUSTOMER' });
    const r = await post({ kind: 'global', message: 'boom' }, token);
    expect(r.status).toBe(202);
    expect(spy.mock.calls.map((c) => String(c[0])).some((l) => l.includes('"user":"user-crash-test"'))).toBe(true);
    spy.mockRestore();
  });

  it('refuses unknown kinds and oversized fields', async () => {
    expect((await post({ kind: 'nope', message: 'x' })).status).toBe(400);
    expect((await post({ kind: 'render', message: 'x'.repeat(1001) })).status).toBe(400);
  });

  it('rate-limits a crash loop per user', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const token = signAccessToken({ sub: `loop-${crypto.randomBytes(4).toString('hex')}`, kind: 'CUSTOMER' });
    const codes: number[] = [];
    for (let i = 0; i < 32; i++) codes.push((await post({ kind: 'global', message: `loop ${i}` }, token)).status);
    expect(codes.slice(0, 30).every((c) => c === 202)).toBe(true);
    expect(codes.slice(30)).toEqual([429, 429]);
    spy.mockRestore();
  });
});
