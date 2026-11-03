/**
 * Turn the purifier's water on/off straight over the home Wi-Fi.
 *
 * The phone talks to the ESP32's local HTTP API (port 80) with plain `fetch`.
 * Never use the axios `api` instance here: it attaches the customer's JWT,
 * which must not be sent to a device on the LAN.
 *
 * Commands are signed (see the local-control contract):
 *   sig = hex(HMAC-SHA256(key = localKey hex string, msg = "valve:<1|0>:<nonce>"))
 * The ESP32 decides whether water may flow: OFF always works, ON only while
 * the plan is paid (403 plan_inactive otherwise). Nothing here can force it on.
 *
 * The access info (serial, IP, key) is cached so the switch keeps working
 * while the SmartRO server is unreachable.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { sha256 } from 'js-sha256';
import { DeviceHealthApi, type LocalAccess } from '../api/endpoints';

const STORAGE_KEY = 'smartro.localPurifier';
const TIMEOUT_MS = 4000;

export const PLAN_INACTIVE_MESSAGE = 'Your plan is not active. Recharge to turn the water on.';
const UNREACHABLE_MESSAGE = 'Make sure your phone is on the same Wi-Fi as the purifier.';
const NOT_A_PURIFIER_MESSAGE = "Something answered at that address, but it isn't your purifier.";

/** GET /api/status on the ESP32 (also returned by a successful POST /api/valve). */
export interface PurifierStatus {
  api: number;
  serial: string;
  fw: string;
  /** Water is flowing right now (always wantOn && planAllows). */
  valveOpen: boolean;
  /** The customer's switch, kept across reboots. */
  wantOn: boolean;
  /** Plan is paid, per the purifier's last answer from SmartRO + its clock. */
  planAllows: boolean;
  /** Server status string, or "UNKNOWN" before the first answer. */
  planStatus: string;
  /** expiresAt + grace days. */
  planUntil: string | null;
  timeKnown: boolean;
  cloudOk: boolean;
  lastCloudSecAgo: number | null;
  message: string | null;
  ip: string;
  ssid: string;
  rssi: number;
}

export type LocalErrorCode =
  /** No answer (wrong Wi-Fi, purifier off, stale IP, timeout) or not a SmartRO purifier at that address. */
  | 'unreachable'
  /** A SmartRO purifier answered, but not the one paired with this account. */
  | 'wrong_device'
  /** ON refused: plan not paid. `message` is the purifier's text. */
  | 'plan_inactive'
  /** The purifier rejected our key: refetch it from the backend. */
  | 'bad_signature'
  /** The purifier (or this app) has no serial/key yet. */
  | 'not_provisioned'
  | 'other';

export type LocalResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: LocalErrorCode; message: string };

/** What the app keeps on the phone to reach the purifier without the backend. */
export interface LocalAccessCache {
  serial: string;
  /** Last address the purifier reported to SmartRO. */
  localIp: string | null;
  localKey: string | null;
  /** Address the customer typed in; wins over localIp while set. */
  manualIp?: string | null;
}

/* ---------------------------------------------------------------- helpers */

/** Normalised dotted IPv4 ("192.168.001.050" -> "192.168.1.50"), or null if it isn't one. */
export function normalizeIPv4(input: string | null | undefined): string | null {
  if (!input) return null;
  const parts = input.trim().split('.');
  if (parts.length !== 4) return null;
  const nums: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    nums.push(n);
  }
  if (nums[0] === 0 || nums.every((n) => n === 255)) return null;
  return nums.join('.');
}

export function isValidIPv4(input: string | null | undefined): boolean {
  return normalizeIPv4(input) !== null;
}

/** The address to talk to: the customer's manual entry, else the one from SmartRO. */
export function purifierIp(access: LocalAccessCache | null | undefined): string | null {
  if (!access) return null;
  return normalizeIPv4(access.manualIp) ?? normalizeIPv4(access.localIp);
}

/** Contract section 2. Exported for tests. */
export function signValve(localKey: string, on: boolean, nonce: string): string {
  return sha256.hmac(localKey, `valve:${on ? '1' : '0'}:${nonce}`);
}

type RawResponse =
  | { reached: true; status: number; body: unknown }
  | { reached: false };

async function request(ip: string, path: string, init?: RequestInit): Promise<RawResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`http://${ip}${path}`, {
      ...init,
      credentials: 'omit',
      signal: controller.signal,
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return { reached: true, status: res.status, body };
  } catch {
    // Network error, DNS, refused, or our own abort on timeout.
    return { reached: false };
  } finally {
    clearTimeout(timer);
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function asStatus(body: unknown): PurifierStatus | null {
  if (!isRecord(body) || typeof body.valveOpen !== 'boolean') return null;
  const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    api: num(body.api) ?? 0,
    serial: str(body.serial),
    fw: str(body.fw),
    valveOpen: body.valveOpen,
    wantOn: typeof body.wantOn === 'boolean' ? body.wantOn : body.valveOpen,
    planAllows: body.planAllows === true,
    planStatus: str(body.planStatus, 'UNKNOWN'),
    planUntil: typeof body.planUntil === 'string' ? body.planUntil : null,
    timeKnown: body.timeKnown === true,
    cloudOk: body.cloudOk === true,
    lastCloudSecAgo: num(body.lastCloudSecAgo),
    message: typeof body.message === 'string' && body.message.trim() ? body.message : null,
    ip: str(body.ip),
    ssid: str(body.ssid),
    rssi: num(body.rssi) ?? 0,
  };
}

type Failure = { ok: false; code: LocalErrorCode | 'bad_nonce'; message: string };

/** Map a non-2xx answer (or an unusable 2xx) to a typed failure. */
function failure(res: RawResponse): Failure {
  if (!res.reached) return { ok: false, code: 'unreachable', message: UNREACHABLE_MESSAGE };
  const body = isRecord(res.body) ? res.body : null;
  const error = typeof body?.error === 'string' ? body.error : null;
  const message = typeof body?.message === 'string' && body.message.trim() ? body.message : null;
  switch (error) {
    case 'plan_inactive':
      return { ok: false, code: 'plan_inactive', message: message ?? PLAN_INACTIVE_MESSAGE };
    case 'bad_signature':
      return { ok: false, code: 'bad_signature', message: "The purifier didn't accept this phone. Pull down to refresh and try again." };
    case 'bad_nonce':
      return { ok: false, code: 'bad_nonce', message: 'The purifier was busy. Try again.' };
    case 'not_provisioned':
      return { ok: false, code: 'not_provisioned', message: "This purifier isn't set up yet. Please contact support." };
    case null:
      // Not a JSON error from our firmware: whatever is at this address isn't the purifier.
      return { ok: false, code: 'unreachable', message: NOT_A_PURIFIER_MESSAGE };
    default:
      return { ok: false, code: 'other', message: message ?? "The purifier couldn't do that. Try again." };
  }
}

function publicFailure(f: Failure): LocalResult<never> {
  return f.code === 'bad_nonce' ? { ok: false, code: 'other', message: f.message } : { ok: false, code: f.code, message: f.message };
}

/* ------------------------------------------------------------ device API */

const sameSerial = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

/**
 * GET /api/status. With `expectedSerial`, the answer only counts if it comes
 * from that purifier: a stale IP that now points at another SmartRO purifier
 * is `wrong_device`, one with no serial yet is `not_provisioned`.
 */
export async function getStatus(ip: string, expectedSerial?: string | null): Promise<LocalResult<PurifierStatus>> {
  const res = await request(ip, '/api/status');
  if (!res.reached || res.status < 200 || res.status >= 300) return publicFailure(failure(res));
  const status = asStatus(res.body);
  if (!status) return { ok: false, code: 'unreachable', message: NOT_A_PURIFIER_MESSAGE };
  if (expectedSerial) {
    if (!status.serial.trim()) {
      return { ok: false, code: 'not_provisioned', message: "This purifier isn't set up yet. Please contact support." };
    }
    if (!sameSerial(status.serial, expectedSerial)) {
      return { ok: false, code: 'wrong_device', message: `That address is a different purifier (${status.serial}). Enter your purifier's address.` };
    }
  }
  return { ok: true, data: status };
}

async function getNonce(ip: string): Promise<{ ok: true; nonce: string } | Failure> {
  const res = await request(ip, '/api/nonce');
  if (!res.reached || res.status < 200 || res.status >= 300) return failure(res);
  const nonce = isRecord(res.body) ? res.body.nonce : null;
  if (typeof nonce !== 'string' || !nonce) return { ok: false, code: 'unreachable', message: NOT_A_PURIFIER_MESSAGE };
  return { ok: true, nonce };
}

async function postValve(ip: string, localKey: string, on: boolean): Promise<{ ok: true; data: PurifierStatus } | Failure> {
  const n = await getNonce(ip);
  if (!n.ok) return n;
  const res = await request(ip, '/api/valve', {
    method: 'POST',
    // text/plain keeps this a "simple" request on web (no CORS preflight);
    // the ESP32 ignores Content-Type and parses the raw JSON body.
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ on, nonce: n.nonce, sig: signValve(localKey, on, n.nonce) }),
  });
  if (!res.reached || res.status < 200 || res.status >= 300) return failure(res);
  const status = asStatus(res.body);
  if (!status) return { ok: false, code: 'other', message: "The purifier's answer didn't make sense. Check the water and try again." };
  return { ok: true, data: status };
}

/**
 * GET /api/nonce, then POST /api/valve. A used/expired nonce (401 bad_nonce)
 * is retried once with a fresh one. A timeout on the POST is reported as
 * `unreachable`; the command may still have been applied, so callers should
 * trust the next status poll rather than retrying blindly.
 */
export async function setValve(ip: string, localKey: string, on: boolean): Promise<LocalResult<PurifierStatus>> {
  let r = await postValve(ip, localKey, on);
  if (!r.ok && r.code === 'bad_nonce') r = await postValve(ip, localKey, on);
  return r.ok ? r : publicFailure(r);
}

/* ----------------------------------------------------------- access cache */

function parseCache(raw: string | null): LocalAccessCache | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!isRecord(v) || typeof v.serial !== 'string' || !v.serial) return null;
    return {
      serial: v.serial,
      localIp: normalizeIPv4(typeof v.localIp === 'string' ? v.localIp : null),
      localKey: typeof v.localKey === 'string' && v.localKey ? v.localKey : null,
      manualIp: normalizeIPv4(typeof v.manualIp === 'string' ? v.manualIp : null),
    };
  } catch {
    return null;
  }
}

export async function getCachedAccess(): Promise<LocalAccessCache | null> {
  try {
    return parseCache(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

async function writeCache(access: LocalAccessCache): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(access));
  } catch {
    /* storage full / unavailable: the switch still works this session */
  }
}

/** Forget the purifier (sign-out, or SmartRO says no device is paired). */
export async function clearLocalAccess(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function merge(cached: LocalAccessCache | null, remote: LocalAccess): LocalAccessCache {
  const same = !!cached && cached.serial === remote.serial;
  const remoteIp = normalizeIPv4(remote.localIp);
  const localIp = remoteIp ?? (same ? cached!.localIp : null);
  let manualIp = same ? cached!.manualIp ?? null : null;
  // The purifier reported a new address since we last looked: trust it over an old manual entry.
  if (manualIp && remoteIp && remoteIp !== cached!.localIp) manualIp = null;
  return { serial: remote.serial, localIp, localKey: remote.localKey || null, manualIp };
}

export type AccessRefresh = {
  access: LocalAccessCache | null;
  /** 'backend' = SmartRO answered (access null means no purifier paired); 'cache' = SmartRO unreachable. */
  source: 'backend' | 'cache';
};

/** Ask SmartRO for the latest IP/key; fall back to the cached copy if it can't be reached. */
export async function refreshAccess(): Promise<AccessRefresh> {
  const cached = await getCachedAccess();
  let remote: LocalAccess | null;
  try {
    remote = await DeviceHealthApi.localAccess();
  } catch {
    return { access: cached, source: 'cache' };
  }
  if (!remote) {
    await clearLocalAccess();
    return { access: null, source: 'backend' };
  }
  const next = merge(cached, remote);
  await writeCache(next);
  return { access: next, source: 'backend' };
}

/** Save (or clear, with null) the address the customer typed in. */
export async function setManualIp(ip: string | null): Promise<LocalAccessCache | null> {
  const cached = await getCachedAccess();
  if (!cached) return null;
  const next = { ...cached, manualIp: normalizeIPv4(ip) };
  await writeCache(next);
  return next;
}

/**
 * Switch the water using the cached access.
 *
 * First confirms (GET /api/status) that the address really is this
 * customer's purifier — a stale IP may now be another device; that comes
 * back as `wrong_device`/`unreachable` and the key is NOT refetched (the UI
 * asks for the address instead). Only when the serial matched and the
 * purifier still rejects the key is a fresh key fetched from SmartRO, once.
 *
 * Returns the access to use from now on (it may have changed, or be null if
 * SmartRO says the purifier is no longer paired).
 */
export async function switchWater(
  access: LocalAccessCache,
  on: boolean,
): Promise<{ result: LocalResult<PurifierStatus>; access: LocalAccessCache | null }> {
  const ip = purifierIp(access);
  if (!ip) return { result: { ok: false, code: 'unreachable', message: UNREACHABLE_MESSAGE }, access };
  if (!access.localKey) {
    return {
      result: { ok: false, code: 'not_provisioned', message: "The water switch isn't set up for this purifier yet. Please contact support." },
      access,
    };
  }

  const check = await getStatus(ip, access.serial);
  if (!check.ok) return { result: check, access };

  const first = await setValve(ip, access.localKey, on);
  if (first.ok || first.code !== 'bad_signature') return { result: first, access };

  const fresh = await refreshAccess();
  if (fresh.source !== 'backend') return { result: first, access };
  if (!fresh.access) return { result: first, access: null };
  const next = fresh.access;
  const nextIp = purifierIp(next);
  if (!next.localKey || next.localKey === access.localKey || !nextIp || !sameSerial(next.serial, access.serial)) {
    return { result: first, access: next };
  }
  if (nextIp !== ip) {
    const recheck = await getStatus(nextIp, next.serial);
    if (!recheck.ok) return { result: recheck, access: next };
  }
  return { result: await setValve(nextIp, next.localKey, on), access: next };
}
