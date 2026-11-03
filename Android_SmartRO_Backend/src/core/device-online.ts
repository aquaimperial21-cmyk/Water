// Whether a purifier counts as online, for every API response and admin view.
//
// A paid purifier now checks the server only about once a day (see
// core/poll-schedule.ts), so "online" means the server heard from it, by a
// /state poll or a heartbeat, within the last 25 hours: a day plus an hour of
// slack for a slow network or a reboot.

type Seen = Date | string | null | undefined;

export interface DevicePresence {
  /** Last authorised /state poll or heartbeat (written at most once a minute). */
  lastSeenAt?: Seen;
  lastHeartbeatAt?: Seen;
}

export const ONLINE_WINDOW_MS = 25 * 60 * 60 * 1000;

function toMs(value: Seen): number {
  if (value === null || value === undefined) return NaN;
  return new Date(value).getTime();
}

/** The latest of lastSeenAt and lastHeartbeatAt, or null if neither is set. */
export function lastSeenOf(device: DevicePresence | null | undefined): Date | null {
  if (!device) return null;
  const times = [toMs(device.lastSeenAt), toMs(device.lastHeartbeatAt)].filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)) : null;
}

/** Online = heard from within the last 25 hours. `now` is epoch ms. */
export function isDeviceOnline(device: DevicePresence | null | undefined, now: number = Date.now()): boolean {
  const seen = lastSeenOf(device);
  return seen !== null && now - seen.getTime() < ONLINE_WINDOW_MS;
}

/** `lastSeenAt` (the latest contact) and `isOnline`, to spread into a response. */
export function presenceOf(device: DevicePresence | null | undefined, now: number = Date.now()) {
  return { lastSeenAt: lastSeenOf(device), isOnline: isDeviceOnline(device, now) };
}
