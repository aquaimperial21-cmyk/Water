// A device token lets its holder pose as that purifier, so API responses carry
// only `hasToken`. Admins read the token itself through the audited
// GET /devices/admin/:serial/token route.

import { createHmac } from 'node:crypto';

// The key the customer app signs local Wi-Fi valve commands with. The ESP32
// derives the same value from the token flashed onto it, so the app never sees
// the token. Re-issuing the token changes this key too.
//   localKey = lowercase hex(HMAC-SHA256(key = token UTF-8 bytes, msg = "smartro-local-v1"))
export function localKeyFor(deviceToken: string): string {
  return createHmac('sha256', Buffer.from(deviceToken, 'utf8')).update('smartro-local-v1').digest('hex');
}

type WithToken = { deviceToken: string | null };
export type TokenHidden<T extends WithToken> = Omit<T, 'deviceToken'> & { hasToken: boolean };

export function hideToken<T extends WithToken>(device: T): TokenHidden<T>;
export function hideToken<T extends WithToken>(device: T | null): TokenHidden<T> | null;
export function hideToken<T extends WithToken>(device: T | null): TokenHidden<T> | null {
  if (!device) return null;
  const { deviceToken, ...rest } = device;
  return { ...rest, hasToken: Boolean(deviceToken) };
}
