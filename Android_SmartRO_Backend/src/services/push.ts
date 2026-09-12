// Push notification service — delivers via the Expo Push API.
// Expo's HTTP endpoint accepts batches of up to 100 messages and handles
// both FCM (Android) and APNs (iOS) under the hood, which keeps SmartRO
// agnostic of Apple/Google certificate plumbing while the prototype runs on
// Expo Managed RN.
//
// Send is best-effort and fire-and-forget from the caller's perspective:
// failures are logged + the Notification row is marked FAILED, but they do
// not surface to the customer-facing endpoint that triggered them.
//
// Env:
//   PUSH_DRIVER=expo|stub   (default 'stub' — logs to console)
//   EXPO_ACCESS_TOKEN=...    optional; required for "enhanced security" on Expo

import { prisma } from '../core/prisma';

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
}

interface PushDriver {
  name: string;
  send(tokens: string[], payload: PushPayload): Promise<PushTicket[]>;
}

const stubDriver: PushDriver = {
  name: 'stub',
  async send(tokens, payload) {
    // eslint-disable-next-line no-console
    console.log(`[push:stub] → ${tokens.length} tokens: ${payload.title} — ${payload.body}`);
    return tokens.map((_, i) => ({ status: 'ok' as const, id: `stub-${Date.now()}-${i}` }));
  },
};

const expoDriver: PushDriver = {
  name: 'expo',
  async send(tokens, payload) {
    if (tokens.length === 0) return [];
    const messages = tokens.map((to) => ({
      to,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    }));
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    };
    const token = process.env.EXPO_ACCESS_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(EXPO_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
    });
    if (!res.ok) throw new Error(`Expo push HTTP ${res.status}`);
    const body = (await res.json()) as { data: PushTicket[] };
    return body.data ?? [];
  },
};

let cached: PushDriver | null = null;
function getDriver(): PushDriver {
  if (cached) return cached;
  cached = process.env.PUSH_DRIVER === 'expo' ? expoDriver : stubDriver;
  // eslint-disable-next-line no-console
  console.log(`[push] driver = ${cached.name}`);
  return cached;
}

export async function sendToUser(userId: string, payload: PushPayload): Promise<{ delivered: number; failed: number }> {
  const tokens = await prisma.pushToken.findMany({ where: { userId }, select: { token: true } });
  if (tokens.length === 0) return { delivered: 0, failed: 0 };
  try {
    const tickets = await getDriver().send(tokens.map((t) => t.token), payload);
    const delivered = tickets.filter((t) => t.status === 'ok').length;
    return { delivered, failed: tickets.length - delivered };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[push] send failed', e);
    return { delivered: 0, failed: tokens.length };
  }
}

// Returns true if the device-registration token is well-formed for Expo Push.
// Expo tokens look like ExponentPushToken[xxxxxxxx] or ExpoPushToken[xxxxxx];
// FCM tokens are long opaque strings — we accept either.
export function isPlausibleToken(t: string): boolean {
  if (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[')) return true;
  return t.length >= 40 && t.length <= 4096;
}
