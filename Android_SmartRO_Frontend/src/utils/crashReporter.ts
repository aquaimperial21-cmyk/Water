// What would otherwise close the app: catch it, keep the app alive on a
// friendly "Something went wrong" screen (components/AppErrorBoundary.tsx),
// and tell the server what broke (POST /app-errors → one "[app-error]" line in
// the server log: the error, the screen, the app version and the update).
//
// Covers: errors while drawing a screen (the error boundary), errors thrown
// anywhere else in JS (the global handler, which in a release build would
// close the app), promise rejections nobody handled, and expo-updates
// problems such as an update that crashed at launch and was rolled back.
// Crashes inside native code can't be caught from here.

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

// Each distinct error once per app run, and not more than a handful: a crash
// loop must not flood the server.
const sent = new Set<string>();
const MAX_REPORTS_PER_RUN = 20;

export async function reportAppError(
  kind: Kind,
  error: unknown,
  opts: { fatal?: boolean; componentStack?: string } = {},
): Promise<void> {
  try {
    const e = error instanceof Error ? error : new Error(String(error));
    const key = `${kind}:${e.message}`;
    if (sent.has(key) || sent.size >= MAX_REPORTS_PER_RUN) return;
    sent.add(key);
    const token = await getAccessToken().catch(() => null);
    await fetch(`${apiBaseUrl}/app-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
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
      }),
    });
  } catch {
    // Reporting must never be the thing that breaks the app.
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
      // error. Show the error screen instead, with a Restart button.
      if (isFatal && !__DEV__ && fatalListeners.size > 0) {
        const e = error instanceof Error ? error : new Error(String(error));
        fatalListeners.forEach((l) => l(e));
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

/**
 * Reports expo-updates errors logged since the last report, e.g. an update
 * that crashed at launch and was rolled back to the previous one.
 */
export async function reportUpdateProblems(): Promise<void> {
  if (!Updates.isEnabled) return;
  try {
    const KEY = 'smartro.updatesLogReportedAt';
    const since = Number(await AsyncStorage.getItem(KEY)) || 0;
    const entries = await Updates.readLogEntriesAsync(7 * 24 * 60 * 60 * 1000);
    const bad = entries.filter((e) => (e.level === 'error' || e.level === 'fatal') && e.timestamp > since);
    for (const e of bad.slice(-5)) {
      await reportAppError('updates', new Error(`${e.code}: ${e.message}`), { fatal: e.level === 'fatal' });
    }
    await AsyncStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Best effort.
  }
}
