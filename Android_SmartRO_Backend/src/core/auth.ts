import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from './prisma';
import { Forbidden, Unauthorized } from './errors';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'dev-access';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh';
const ACCESS_TTL = Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900);
const REFRESH_TTL = Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 2592000);

export type AuthKind = 'CUSTOMER' | 'ADMIN' | 'TECHNICIAN';

export interface AuthPayload {
  sub: string; // user id
  kind: AuthKind;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const token = uuid() + '.' + uuid();
  const expiresAt = new Date(Date.now() + REFRESH_TTL * 1000);
  await prisma.refreshToken.create({ data: { userId, token, expiresAt } });
  return token;
}

export async function rotateRefreshToken(token: string): Promise<{ userId: string; kind: AuthKind; newToken: string }>
{
  const existing = await prisma.refreshToken.findUnique({ where: { token } });
  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    throw Unauthorized('Invalid refresh token');
  }
  const user = await prisma.user.findUnique({ where: { id: existing.userId } });
  if (!user) throw Unauthorized('User not found');
  await prisma.refreshToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
  const newToken = await issueRefreshToken(user.id);
  return { userId: user.id, kind: user.kind as AuthKind, newToken };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { token, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function verifyAccessToken(token: string): AuthPayload {
  try {
    return jwt.verify(token, ACCESS_SECRET) as AuthPayload;
  } catch {
    throw Unauthorized('Invalid or expired access token');
  }
}

export function authRequired(kinds?: AuthKind[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? req.header('Authorization');
    if (!header?.startsWith('Bearer ')) throw Unauthorized('Missing bearer token');
    const token = header.slice('Bearer '.length).trim();
    const payload = verifyAccessToken(token);
    if (kinds && !kinds.includes(payload.kind)) throw Forbidden(`Requires role: ${kinds.join('|')}`);
    req.auth = payload;
    next();
  };
}

export function authOptional() {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? req.header('Authorization');
    if (header?.startsWith('Bearer ')) {
      try {
        req.auth = verifyAccessToken(header.slice('Bearer '.length).trim());
      } catch {
        // ignore
      }
    }
    next();
  };
}
