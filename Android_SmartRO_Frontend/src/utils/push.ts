// Push token registration helper.
//
// Lazy-loads expo-notifications so the bundle doesn't fail in environments
// where the module isn't installed (e.g. the bare Metro web bundle). Calling
// this is a no-op if:
//   - the device doesn't have permission to receive notifications
//   - we're running on an emulator that can't get a token
//   - the module is missing
//
// Tokens captured here are stored server-side in PushToken and used by
// services/push.ts to deliver Expo / FCM / APNs messages.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceHealthApi } from '../api/endpoints';
import { reportAppError } from './crashReporter';

// Types only; the module itself is loaded by notificationsModule() below.
type NotificationsModule = typeof import('expo-notifications');

// SDK 51 requires an explicit EAS projectId when the app isn't running inside
// Expo Go. `eas init` writes it to expoConfig.extra.eas.projectId; until then
// this is undefined and we fall back to the argless call (fine in Expo Go).
function easProjectId(): string | undefined {
  const extra = Constants?.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  return extra?.eas?.projectId ?? (Constants as any)?.easConfig?.projectId;
}

let attempted = false;

export async function registerPushToken(): Promise<void> {
  if (attempted) return; // once per app session
  attempted = true;
  try {
    const Notifications = notificationsModule();
    if (!Notifications) return;

    const settings = await Notifications.getPermissionsAsync();
    let status = settings.status as string;
    if (status !== 'granted') {
      const r = await Notifications.requestPermissionsAsync();
      status = r.status as string;
    }
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      // Android 8+ drops notifications that arrive without a channel.
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = easProjectId();
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token: string | undefined = tokenResp?.data;
    if (!token) return;

    await DeviceHealthApi.registerPushToken(token, 'EXPO', Platform.OS);
  } catch {
    // Silently swallow — push is best-effort. The customer can still use the
    // app; in-app notifications continue to land via the Notification inbox.
  }
}

// Loaded once and kept, even when loading fails. Trying again never helps:
// Metro remembers a module that failed to load and throws the same error on
// every later require, and from an effect or a tap that error closes the app
// (Metro reports it as fatal itself and the require returns undefined, so a
// try/catch doesn't help).
let notifications: NotificationsModule | null | undefined; // undefined: not loaded yet

/** expo-notifications, or null where it can't run (web preview, missing module). */
function notificationsModule(): NotificationsModule | null {
  if (notifications !== undefined) return notifications;
  notifications = null;
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notifications = (require('expo-notifications') as NotificationsModule | undefined) ?? null;
  } catch (e) {
    // The app ships with it, so this is a bug.
    void reportAppError('global', e);
  }
  return notifications;
}

/**
 * Show pushes that arrive while the app is open. Without a handler,
 * expo-notifications drops them silently.
 */
export function showPushesWhileOpen(): void {
  const Notifications = notificationsModule();
  if (!Notifications) return;
  // Android 8.0 (API 26) only: it closes the app (RemoteServiceException) when
  // a notification's small icon is the adaptive launcher icon, and that's the
  // icon this APK uses. So there, pushes that arrive while the app is open
  // aren't shown (they're still in the in-app inbox). The real fix is a
  // notification icon, which needs a new APK; pushes that arrive while the app
  // is in the background still use the launcher icon until then.
  const show = !(Platform.OS === 'android' && Platform.Version === 26);
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowAlert: show, shouldPlaySound: show, shouldSetBadge: false }),
    });
  } catch (e) {
    void reportAppError('global', e);
  }
}

// Ids of the push taps already acted on, newest last. The tap that launched
// the app comes back later as if new: when the app is reopened from Recents
// (Android starts it again with that tap), and after an in-app restart, e.g.
// into an update (expo-notifications keeps that tap for as long as the app's
// process lives). Every push has its own id, so a repeated id is an old tap.
// Kept on the phone so it outlasts restarts, and the last 50 rather than just
// the last one, since the tap that launched the app can be several taps ago.
const HANDLED_TAPS_KEY = 'smartro.handledPushTaps';
const MAX_HANDLED_TAPS = 50;
let handledTaps: Promise<string[]> | undefined; // read from storage once per run

/** Remembers a push tap. False if it was remembered already. */
async function rememberTap(id: string): Promise<boolean> {
  if (!handledTaps) {
    handledTaps = AsyncStorage.getItem(HANDLED_TAPS_KEY)
      .then((raw) => {
        const ids: unknown = raw ? JSON.parse(raw) : [];
        return Array.isArray(ids) ? ids.filter((v): v is string => typeof v === 'string') : [];
      })
      .catch((e) => {
        // Unreadable: the tap is still acted on.
        void reportAppError('global', e);
        return [];
      });
  }
  const ids = await handledTaps;
  if (ids.includes(id)) return false;
  ids.push(id);
  ids.splice(0, ids.length - MAX_HANDLED_TAPS); // drop the oldest
  AsyncStorage.setItem(HANDLED_TAPS_KEY, JSON.stringify(ids)).catch((e) => void reportAppError('global', e));
  return true;
}

/**
 * Calls `open(screen)` when the customer taps a push whose data names a
 * screen (the server sends screen: 'Notifications'), including the push that
 * launched the app. Returns a function that stops listening.
 */
export function onPushTapped(open: (screen: string) => void): () => void {
  const Notifications = notificationsModule();
  if (!Notifications) return () => {};
  const handle = (resp: any) => {
    try {
      const screen = resp?.notification?.request?.content?.data?.screen;
      if (typeof screen === 'string') open(screen);
    } catch (e) {
      void reportAppError('global', e);
    }
    // Forget a handled tap, so it isn't acted on again when this is set up
    // again (e.g. after signing out and back in).
    try {
      Notifications.clearLastNotificationResponseAsync().catch((e) => void reportAppError('global', e));
    } catch (e) {
      void reportAppError('global', e);
    }
  };
  // Each tap once (see rememberTap). Every push has an id; a response without
  // one can't be told apart from an old tap. Remembered before it's acted on,
  // so a tap whose screen crashes isn't replayed by the Restart button.
  const handleOnce = (resp: any) => {
    const id = resp?.notification?.request?.identifier;
    if (typeof id !== 'string' || !id) return;
    rememberTap(id)
      .then((isNew) => {
        if (isNew) handle(resp);
      })
      .catch((e) => void reportAppError('global', e));
  };
  let sub: { remove: () => void } | undefined;
  try {
    sub = Notifications.addNotificationResponseReceivedListener(handleOnce);
  } catch (e) {
    void reportAppError('global', e);
  }
  // The tap that started the app, or an old one handed back (handleOnce skips that).
  Notifications.getLastNotificationResponseAsync()
    .then((resp) => {
      if (resp) handleOnce(resp);
    })
    // Nothing for the customer to see, but it shouldn't fail: report it.
    .catch((e) => void reportAppError('global', e));
  return () => {
    try {
      sub?.remove();
    } catch (e) {
      void reportAppError('global', e);
    }
  };
}
