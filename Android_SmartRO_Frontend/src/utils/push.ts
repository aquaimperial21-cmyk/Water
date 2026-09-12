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
