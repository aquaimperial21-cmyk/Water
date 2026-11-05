// Online = the server heard from the purifier (a /state poll or a heartbeat)
// within the last 25 hours. Pure function, no database.

import { describe, it, expect } from 'vitest';
import { isDeviceOnline, lastSeenOf, ONLINE_WINDOW_MS, presenceOf } from '../src/core/device-online';

const NOW = Date.UTC(2026, 10, 4, 6, 0, 0);
const HOUR = 3600 * 1000;
const ago = (ms: number) => new Date(NOW - ms);

describe('isDeviceOnline', () => {
  it('the window is 25 hours', () => {
    expect(ONLINE_WINDOW_MS).toBe(25 * HOUR);
  });

  it('never seen is offline', () => {
    expect(isDeviceOnline(null, NOW)).toBe(false);
    expect(isDeviceOnline(undefined, NOW)).toBe(false);
    expect(isDeviceOnline({}, NOW)).toBe(false);
    expect(isDeviceOnline({ lastSeenAt: null, lastHeartbeatAt: null }, NOW)).toBe(false);
  });

  it('online up to 25 hours after the last contact, offline from then on', () => {
    expect(isDeviceOnline({ lastSeenAt: ago(0) }, NOW)).toBe(true);
    expect(isDeviceOnline({ lastSeenAt: ago(24 * HOUR) }, NOW)).toBe(true);
    expect(isDeviceOnline({ lastSeenAt: ago(25 * HOUR - 1) }, NOW)).toBe(true);
    expect(isDeviceOnline({ lastSeenAt: ago(25 * HOUR) }, NOW)).toBe(false);
    expect(isDeviceOnline({ lastSeenAt: ago(3 * 24 * HOUR) }, NOW)).toBe(false);
  });

  it('uses whichever of lastSeenAt and lastHeartbeatAt is later', () => {
    // A unit that only polls /state (no recent heartbeat) is online...
    expect(isDeviceOnline({ lastSeenAt: ago(HOUR), lastHeartbeatAt: ago(48 * HOUR) }, NOW)).toBe(true);
    // ...and so is a row from before lastSeenAt existed, by its heartbeat.
    expect(isDeviceOnline({ lastSeenAt: null, lastHeartbeatAt: ago(2 * HOUR) }, NOW)).toBe(true);
    expect(isDeviceOnline({ lastSeenAt: ago(30 * HOUR), lastHeartbeatAt: ago(26 * HOUR) }, NOW)).toBe(false);
  });

  it('accepts ISO strings and ignores unreadable dates', () => {
    expect(isDeviceOnline({ lastSeenAt: ago(HOUR).toISOString() }, NOW)).toBe(true);
    expect(isDeviceOnline({ lastSeenAt: 'garbage', lastHeartbeatAt: ago(HOUR) }, NOW)).toBe(true);
    expect(isDeviceOnline({ lastSeenAt: 'garbage' }, NOW)).toBe(false);
  });
});

describe('lastSeenOf / presenceOf', () => {
  it('gives the latest contact, or null', () => {
    expect(lastSeenOf({ lastSeenAt: ago(HOUR), lastHeartbeatAt: ago(2 * HOUR) })).toEqual(ago(HOUR));
    expect(lastSeenOf({ lastSeenAt: ago(2 * HOUR), lastHeartbeatAt: ago(HOUR) })).toEqual(ago(HOUR));
    expect(lastSeenOf({ lastSeenAt: null, lastHeartbeatAt: null })).toBeNull();
  });

  it('presenceOf spreads lastSeenAt and isOnline', () => {
    expect(presenceOf({ lastSeenAt: ago(HOUR) }, NOW)).toEqual({ lastSeenAt: ago(HOUR), isOnline: true });
    expect(presenceOf(null, NOW)).toEqual({ lastSeenAt: null, isOnline: false });
  });
});
