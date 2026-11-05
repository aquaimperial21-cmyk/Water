// What would otherwise close the app: catch it, keep the app alive on a
// friendly "Something went wrong" screen (components/AppErrorBoundary.tsx),
// and tell the server what broke (POST /app-errors → one "[app-error]" line in
// the server log: the error, the screen, the app version and the update).
//
// Covers: errors while drawing a screen (the error boundary), errors thrown
// anywhere else in JS (the global handler, which in a release build would
// close the app), promise rejections nobody handled, and expo-updates
// problems such as an emergency launch or a fall back to an older update.
// Crashes inside native code can't be caught from here.
//
// Each report is saved on the phone before it is sent and deleted once the
// server has it, so one cut off by the app closing, or by no internet, is sent
// on the next launch instead (resendStoredReports).

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiBaseUrl, getAccessToken } from '../api/client';

type Kind = 'render' | 'global' | 'promise' | 'updates';

let currentScreen: string | undefined;
/** Called by the navigator on every screen change, so reports name the screen. */
export function setCurrentScreen(name: string | undefined): void {
  currentScreen = name;
}

/** Whatever was thrown, as an Error. Never throws (String() can, on odd objects). */
function toError(x: unknown): Error {
  if (x instanceof Error) return x;
  try {
    return new Error(String(x));
  } catch {
    return new Error('Unknown error');
  }
}

// Each distinct error once per app run, and not more than a handful: a crash
// loop must not flood the server.
const sent = new Set<string>();
const MAX_REPORTS_PER_RUN = 20;

// Unsent reports: one AsyncStorage entry each, named by when it was made.
// Only the newest MAX_STORED are kept.
const STORED_PREFIX = 'smartro.unsentReport.';
const MAX_STORED = 5;
const SEND_TIMEOUT_MS = 15_000;
const storedThisRun = new Set<string>(); // this run is sending these already
const inFlight = new Set<Promise<void>>();
let seq = 0;

// Nothing below throws or rejects, so a report that fails can never end up
// in the global handler (and be reported again, and fail again...).

export async function reportAppError(
  kind: Kind,
  error: unknown,
  opts: { fatal?: boolean; componentStack?: string } = {},
): Promise<void> {
  try {
    const e = toError(error);
    const key = `${kind}:${e.message}`;
    if (sent.has(key) || sent.size >= MAX_REPORTS_PER_RUN) return;
    sent.add(key);
    const body = JSON.stringify({
      kind,
      fatal: !!opts.fatal,
      message: `${e.name}: ${e.message}`.slice(0, 1000),
      stack: e.stack?.slice(0, 6000),
      componentStack: opts.componentStack?.slice(0, 4000),
      screen: currentScreen,
      appVersion: Constants.expoConfig?.version,
      updateId: Updates.isEnabled ? (Updates.updateId ?? 'embedded') : 'dev',
      platform: Platform.OS,
      osVersion: String(Platform.Version),
    });
    // Saved right away, before anything is awaited: a fatal error can close
    // the app straight after this.
    const storeKey = `${STORED_PREFIX}${Date.now()}.${String(++seq).padStart(3, '0')}`;
    storedThisRun.add(storeKey);
    const saved = AsyncStorage.setItem(storeKey, body).then(trimStored, () => {});
    await track(Promise.all([saved, send(storeKey, body)]));
  } catch {
    // Reporting must never be the thing that breaks the app.
  }
}

/** Posts one report and deletes its saved copy once the server has it. */
async function send(storeKey: string, body: string): Promise<void> {
  try {
    const token = await getAccessToken().catch(() => null);
    // RN's fetch has no timeout of its own: a stuck request would never finish.
    const abort = new AbortController();
    const timer = setTimeout(() => {
      try {
        abort.abort();
      } catch {
        // A throw in a timer goes to the global handler.
      }
    }, SEND_TIMEOUT_MS);
    const res = await fetch(`${apiBaseUrl}/app-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body,
      signal: abort.signal,
    }).finally(() => clearTimeout(timer));
    // 400: the server can't take this report at all, so sending it again won't help.
    if (res.ok || res.status === 400) await AsyncStorage.removeItem(storeKey);
  } catch {
    // No internet, timed out or the server is down: the saved copy goes next launch.
  }
}

/** Keeps `p` in inFlight until it settles. The result never rejects. */
function track(p: Promise<unknown>): Promise<void> {
  const done = p.then(
    () => {},
    () => {},
  );
  inFlight.add(done);
  void done.then(() => inFlight.delete(done));
  return done;
}

/** Waits for the reports being sent right now (any that fail stay saved for the next launch). */
export function flushReports(): Promise<void> {
  return Promise.all([...inFlight]).then(() => {});
}

/** Saved report keys, oldest first. */
async function storedKeys(): Promise<string[]> {
  return (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(STORED_PREFIX)).sort();
}

/** Deletes all but the newest MAX_STORED saved reports. */
async function trimStored(): Promise<void> {
  try {
    const keys = await storedKeys();
    if (keys.length > MAX_STORED) await AsyncStorage.multiRemove(keys.slice(0, keys.length - MAX_STORED));
  } catch {
    // Best effort.
  }
}

/**
 * Sends the reports an earlier run saved but couldn't send (no internet, or
 * the app closed first). Called once at startup.
 */
export async function resendStoredReports(): Promise<void> {
  try {
    await trimStored();
    const keys = (await storedKeys()).filter((k) => !storedThisRun.has(k));
    // Claimed, so a second call can't send them again while these are on their way.
    keys.forEach((k) => storedThisRun.add(k));
    const entries = await AsyncStorage.multiGet(keys);
    await Promise.all(entries.map(([key, body]) => (body ? track(send(key, body)) : null)));
  } catch {
    // Best effort.
  }
}

type FatalListener = (error: Error) => void;
const fatalListeners = new Set<FatalListener>();
/** The error screen listens here, so a fatal error shows it instead of closing the app. */
export function onFatalError(listener: FatalListener): () => void {
  fatalListeners.add(listener);
  return () => {
    fatalListeners.delete(listener);
  };
}

/** Shows the error screen. False if it isn't there yet or couldn't be shown. */
function showErrorScreen(error: unknown): boolean {
  if (fatalListeners.size === 0) return false;
  try {
    const e = toError(error);
    fatalListeners.forEach((l) => l(e));
    return true;
  } catch {
    return false;
  }
}

let installed = false;
export function installGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;

  const EU = (globalThis as any).ErrorUtils;
  if (EU?.setGlobalHandler) {
    const previous = EU.getGlobalHandler?.();
    EU.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      void reportAppError('global', error, { fatal: !!isFatal });
      // In a release build the default handler closes the app on a fatal
      // error. Show the error screen instead, with a Restart button, and hand
      // the error on as non-fatal: React Native then only logs it (logcat).
      if (isFatal && !__DEV__ && showErrorScreen(error)) {
        try {
          previous?.(error, false);
        } catch {
          // Only the native log line is lost.
        }
        return;
      }
      previous?.(error, isFatal);
    });
  }

  // Release builds don't track unhandled promise rejections (dev does, for
  // LogBox). They don't close the app, but each one is a bug worth knowing.
  const hermes = (globalThis as any).HermesInternal;
  if (!__DEV__ && hermes?.enablePromiseRejectionTracker) {
    hermes.enablePromiseRejectionTracker({
      allRejections: true,
      onUnhandled: (_id: number, rejection: unknown) => void reportAppError('promise', rejection),
      onHandled: () => {},
    });
  }
}

const LAST_UPDATE_KEY = 'smartro.lastUpdate';
const LOG_REPORTED_AT_KEY = 'smartro.updatesLogReportedAt';

/**
 * Reports over-the-air update problems, at startup: an emergency launch
 * (expo-updates couldn't start an update and fell back to the one built into
 * the APK), a rollback (the update running now is older than one that ran
 * before), and errors in the expo-updates log.
 */
export async function reportUpdateProblems(): Promise<void> {
  if (!Updates.isEnabled) return;
  try {
    if (Updates.isEmergencyLaunch) {
      void reportAppError(
        'updates',
        new Error(`EmergencyLaunch: ${Updates.emergencyLaunchReason ?? 'no reason given'}`),
      );
    } else {
      await reportRollback();
    }
  } catch {
    // Best effort.
  }
  try {
    await reportUpdatesLog();
  } catch {
    // Best effort.
  }
}

/** Reports it when the update running now is older than the last one seen. */
async function reportRollback(): Promise<void> {
  const id = Updates.updateId;
  const at = Updates.createdAt?.getTime();
  if (!id || !at) return;
  const runtime = Updates.runtimeVersion;
  const raw = await AsyncStorage.getItem(LAST_UPDATE_KEY);
  let last: { id?: unknown; at?: unknown; runtime?: unknown } | null = null;
  try {
    last = raw ? JSON.parse(raw) : null;
  } catch {
    // Unreadable: this update is the new starting point.
  }
  // Same runtime only: a new APK's built-in update can be older than the
  // last update the old APK downloaded, and that's no rollback.
  if (
    last &&
    last.runtime === runtime &&
    typeof last.id === 'string' &&
    typeof last.at === 'number' &&
    last.id !== id &&
    at < last.at
  ) {
    void reportAppError(
      'updates',
      new Error(
        `Rollback: running update ${id} (${new Date(at).toISOString()}), older than ${last.id} (${new Date(last.at).toISOString()}) that ran before`,
      ),
    );
  }
  // After the report (which saves itself straight away), so the app closing
  // here can't lose it. The update running now is the one to compare against
  // next time, so one rollback is reported once.
  await AsyncStorage.setItem(LAST_UPDATE_KEY, JSON.stringify({ id, at, runtime }));
}

/** Reports errors in the expo-updates log since the last look. */
async function reportUpdatesLog(): Promise<void> {
  const since = Number(await AsyncStorage.getItem(LOG_REPORTED_AT_KEY)) || 0;
  // On Android, expo-updates 0.25 returns only about the last 86 s whatever is
  // asked (its "one day" is 86400 ms): enough to catch a launch that crashed
  // and was restarted on an older update a moment ago.
  const entries = await Updates.readLogEntriesAsync(24 * 60 * 60 * 1000);
  const bad = entries.filter(
    (e) =>
      (e.level === 'error' || e.level === 'fatal') &&
      e.timestamp > since &&
      // Logged as errors on ordinary launches, so not problems: "no update
      // available", and events sent before the JS side was listening.
      e.code !== 'NoUpdatesAvailable' &&
      !e.message?.startsWith('Could not emit'),
  );
  for (const e of bad.slice(-5)) {
    void reportAppError('updates', new Error(`${e.code}: ${e.message}`), { fatal: e.level === 'fatal' });
  }
  await AsyncStorage.setItem(LOG_REPORTED_AT_KEY, String(Date.now()));
}
