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
import { DeviceHealthApi } from '../api/endpoints';

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

    const tokenResp = await Notifications.getExpoPushTokenAsync();
    const token: string | undefined = tokenResp?.data;
    if (!token) return;

    await DeviceHealthApi.registerPushToken(token, 'EXPO', Platform.OS);
  } catch {
    // Silently swallow — push is best-effort. The customer can still use the
    // app; in-app notifications continue to land via the Notification inbox.
  }
}
