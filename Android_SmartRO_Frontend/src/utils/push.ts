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
import { DeviceHealthApi } from '../api/endpoints';

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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications');

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

/** expo-notifications, or null where it can't run (web preview, missing module). */
function notificationsModule(): any | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications');
  } catch {
    return null;
  }
}

/**
 * Show pushes that arrive while the app is open. Without a handler,
 * expo-notifications drops them silently.
 */
export function showPushesWhileOpen(): void {
  const Notifications = notificationsModule();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
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
    const screen = resp?.notification?.request?.content?.data?.screen;
    if (typeof screen === 'string') open(screen);
  };
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  // The tap that started the app. Only a recent one: Android can hand back
  // an old response on a later, ordinary launch.
  Notifications.getLastNotificationResponseAsync()
    .then((resp: any) => {
      const at = Number(resp?.notification?.date ?? 0);
      if (resp && Date.now() - at < 60_000) handle(resp);
    })
    .catch(() => {});
  return () => sub.remove();
}
