// How often a purifier checks the server: daily while a plan is comfortably
// paid, hourly in the last 3 days, fast just after the end, slower again after
// a long lapse. Pure function, no database.

import { describe, it, expect } from 'vitest';
import { parseGraceDays, pollIntervalSec, POLL_MAX_SEC, POLL_MIN_SEC } from '../src/core/poll-schedule';

const NOW = Date.UTC(2026, 10, 3, 6, 0, 0);
const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** The handler's own water rule (device.ts /:serial/state), for building inputs. */
function handlerAllowFlow(status: string, expiresAt: Date, graceDays: number, now: number) {
  const graceEnd = expiresAt.getTime() + graceDays * DAY;
  return (status === 'ACTIVE' || status === 'GRACE') && now <= graceEnd;
}

/** Poll interval for a plan whose water ends `msLeft` from NOW (negative: already ended). */
function poll(status: string, msLeft: number, graceDays = 0) {
  const expiresAt = new Date(NOW + msLeft - graceDays * DAY);
  return pollIntervalSec({
    subscription: { status, expiresAt },
    allowFlow: handlerAllowFlow(status, expiresAt, graceDays, NOW),
    graceDays,
    now: NOW,
  });
}

describe('no subscription', () => {
  it('checks once an hour', () => {
    expect(pollIntervalSec({ subscription: null, allowFlow: false, graceDays: 0, now: NOW })).toBe(3600);
    expect(pollIntervalSec({ subscription: undefined, allowFlow: false, graceDays: 0, now: NOW })).toBe(3600);
  });
});

describe('plan running (water allowed)', () => {
  it('checks once a day while more than 3 days are left', () => {
    expect(poll('ACTIVE', 400 * DAY)).toBe(86400);
    expect(poll('ACTIVE', 30 * DAY)).toBe(86400);
    expect(poll('ACTIVE', 14 * DAY)).toBe(86400);
    expect(poll('ACTIVE', 4 * DAY)).toBe(86400);
    expect(poll('ACTIVE', 3 * DAY + SEC)).toBe(86400);
  });

  it('checks once an hour from exactly 3 days left', () => {
    expect(poll('ACTIVE', 3 * DAY)).toBe(3600);
    expect(poll('ACTIVE', 2 * DAY)).toBe(3600);
    expect(poll('ACTIVE', DAY)).toBe(3600);
    expect(poll('ACTIVE', 2 * HOUR)).toBe(3600);
    expect(poll('ACTIVE', HOUR)).toBe(3600);
  });

  it('times one check for just after the end', () => {
    expect(poll('ACTIVE', HOUR - 10 * SEC)).toBe(3595);
    expect(poll('ACTIVE', 30 * MIN)).toBe(1805);
    expect(poll('ACTIVE', 20 * MIN)).toBe(1205);
    expect(poll('ACTIVE', 10 * MIN)).toBe(605);
    expect(poll('ACTIVE', 26 * SEC)).toBe(31);
  });

  it('the daily check never lands past the end', () => {
    // Daily is only used with more than 3 days left; inside the hourly window
    // the end check (end + 5 s) takes over once it is the sooner of the two.
    for (const msLeft of [3 * DAY + SEC, 3 * DAY + HOUR, 5 * DAY, 30 * DAY]) {
      expect(poll('ACTIVE', msLeft) * SEC).toBeLessThan(msLeft);
    }
  });

  it('rounds a part-second up to whole seconds', () => {
    expect(poll('ACTIVE', 600 * SEC + 200)).toBe(606);
    expect(Number.isInteger(poll('ACTIVE', 123_456))).toBe(true);
  });

  it('never asks for less than 30 seconds', () => {
    expect(poll('ACTIVE', 10 * SEC)).toBe(30);
    expect(poll('ACTIVE', 25 * SEC)).toBe(30);
    expect(poll('ACTIVE', 1)).toBe(30);
  });

  it('at the exact end instant water is still allowed, and the next check is 30 s away', () => {
    const expiresAt = new Date(NOW);
    const allowFlow = handlerAllowFlow('ACTIVE', expiresAt, 0, NOW);
    expect(allowFlow).toBe(true);
    expect(pollIntervalSec({ subscription: { status: 'ACTIVE', expiresAt }, allowFlow, graceDays: 0, now: NOW })).toBe(30);
  });

  it('a plan in GRACE within its window follows the same schedule', () => {
    expect(poll('GRACE', 5 * DAY, 7)).toBe(86400);
    expect(poll('GRACE', 2 * DAY, 7)).toBe(3600);
    expect(poll('GRACE', 10 * MIN, 7)).toBe(605);
  });

  it('grace days push the end out past expiresAt', () => {
    const expiresAt = new Date(NOW - DAY); // expired yesterday...
    const graceDays = 5; // ...but water runs 5 days past expiry: 4 days left
    const allowFlow = handlerAllowFlow('ACTIVE', expiresAt, graceDays, NOW);
    expect(allowFlow).toBe(true);
    expect(pollIntervalSec({ subscription: { status: 'ACTIVE', expiresAt }, allowFlow, graceDays, now: NOW })).toBe(86400);
    // Same expiry with no grace: ended a day ago.
    expect(pollIntervalSec({ subscription: { status: 'ACTIVE', expiresAt }, allowFlow: false, graceDays: 0, now: NOW })).toBe(300);
  });

  it('expiresAt given as an ISO string works the same as a Date', () => {
    const expiresAt = new Date(NOW + 10 * MIN).toISOString();
    expect(pollIntervalSec({ subscription: { status: 'ACTIVE', expiresAt }, allowFlow: true, graceDays: 0, now: NOW })).toBe(605);
  });
});

describe('plan ended, waiting for a recharge', () => {
  it('checks every minute for the first day', () => {
    expect(poll('ACTIVE', -1)).toBe(60);
    expect(poll('ACTIVE', -MIN)).toBe(60);
    expect(poll('GRACE', -23 * HOUR)).toBe(60);
    expect(poll('ACTIVE', -(DAY - SEC))).toBe(60);
  });

  it('checks every 5 minutes from one day to one week', () => {
    expect(poll('ACTIVE', -DAY)).toBe(300);
    expect(poll('GRACE', -3 * DAY)).toBe(300);
    expect(poll('ACTIVE', -7 * DAY)).toBe(300);
  });

  it('checks every 15 minutes after more than a week', () => {
    expect(poll('ACTIVE', -(7 * DAY + SEC))).toBe(900);
    expect(poll('GRACE', -90 * DAY)).toBe(900);
  });

  it('GRACE past its grace window counts from the end of grace, not expiresAt', () => {
    // Expired 10 days ago with 7 grace days: water stopped 3 days ago.
    expect(poll('GRACE', -3 * DAY, 7)).toBe(300);
  });
});

describe('missing or unreadable end date', () => {
  const bad: Array<[string, Date | string | number | null | undefined]> = [
    ['null', null],
    ['undefined', undefined],
    ['Invalid Date', new Date('not a date')],
    ['NaN', NaN],
    ['garbage string', 'tomorrow-ish'],
  ];

  it.each(bad)('%s counts as ended long ago and does not throw', (_label, expiresAt) => {
    for (const status of ['ACTIVE', 'GRACE']) {
      for (const allowFlow of [true, false]) {
        expect(() => pollIntervalSec({ subscription: { status, expiresAt }, allowFlow, graceDays: 0, now: NOW })).not.toThrow();
        expect(pollIntervalSec({ subscription: { status, expiresAt }, allowFlow, graceDays: 0, now: NOW })).toBe(900);
      }
    }
  });

  it('an unreadable clock counts the same way', () => {
    const subscription = { status: 'ACTIVE', expiresAt: new Date(NOW) };
    expect(pollIntervalSec({ subscription, allowFlow: true, graceDays: 0, now: NaN })).toBe(900);
  });
});

describe('other statuses', () => {
  // PAUSED: a legacy row from before the pause feature was removed. No water,
  // and no schedule of its own.
  it.each(['SUSPENDED', 'CLOSED', 'TRIAL', 'PAUSED', '', 'active', 'SOMETHING_NEW'])('%j checks once an hour', (status) => {
    expect(poll(status, 30 * DAY)).toBe(3600);
    expect(poll(status, 10 * SEC)).toBe(3600);
    expect(poll(status, -30 * DAY)).toBe(3600);
  });

  it('a status that is not even a string does not throw', () => {
    const subscription = { status: undefined as unknown as string, expiresAt: new Date(NOW) };
    expect(pollIntervalSec({ subscription, allowFlow: false, graceDays: 0, now: NOW })).toBe(3600);
  });
});

describe('DEVICE_GRACE_DAYS', () => {
  it('reads a plain number', () => {
    expect(parseGraceDays('2')).toBe(2);
    expect(parseGraceDays(' 3 ')).toBe(3);
    expect(parseGraceDays('1.5')).toBe(1.5);
  });

  it('falls back to 0 when unset, malformed, negative or infinite', () => {
    for (const raw of [undefined, '', '0', '2 days', 'abc', '-1', 'Infinity', 'NaN']) {
      expect(parseGraceDays(raw)).toBe(0);
    }
  });

  it('a bad graceDays passed straight in is treated as 0', () => {
    const subscription = { status: 'ACTIVE', expiresAt: new Date(NOW + 10 * MIN) };
    for (const graceDays of [NaN, -3, Infinity]) {
      expect(pollIntervalSec({ subscription, allowFlow: true, graceDays, now: NOW })).toBe(605);
    }
  });
});

describe('every answer is in range', () => {
  it('the range is 30 seconds to one day', () => {
    expect(POLL_MIN_SEC).toBe(30);
    expect(POLL_MAX_SEC).toBe(86400);
  });

  it('is a whole number of seconds from 30 to 86400', () => {
    const offsets = [
      -400 * DAY, -8 * DAY, -7 * DAY, -DAY - 1, -DAY, -HOUR, -1, 0, 1, 999, 25 * SEC, 25 * SEC + 1,
      10 * MIN + 1, 3 * DAY - 1, 3 * DAY, 3 * DAY + 1, 400 * DAY,
    ];
    for (const status of ['ACTIVE', 'GRACE', 'PAUSED', 'SUSPENDED', 'CLOSED', 'TRIAL', '']) {
      for (const graceDays of [0, 2]) {
        for (const msLeft of offsets) {
          const sec = poll(status, msLeft, graceDays);
          expect(Number.isInteger(sec)).toBe(true);
          expect(sec).toBeGreaterThanOrEqual(30);
          expect(sec).toBeLessThanOrEqual(86400);
        }
      }
    }
  });

  it('a running plan never asks for more than a day, however long is left', () => {
    expect(poll('ACTIVE', 10 * 365 * DAY)).toBe(86400);
    expect(poll('GRACE', 10 * 365 * DAY, 2)).toBe(86400);
  });
});

describe('test plans (product tagged TEST) check every minute', () => {
  const base = { graceDays: 0, now: NOW, fastPoll: true };
  it('a running plan with weeks left, or in its last 3 days', () => {
    expect(pollIntervalSec({ ...base, subscription: { status: 'ACTIVE', expiresAt: new Date(NOW + 30 * DAY) }, allowFlow: true })).toBe(60);
    expect(pollIntervalSec({ ...base, subscription: { status: 'ACTIVE', expiresAt: new Date(NOW + 400 * DAY) }, allowFlow: true })).toBe(60);
    expect(pollIntervalSec({ ...base, subscription: { status: 'GRACE', expiresAt: new Date(NOW + 2 * DAY) }, allowFlow: true })).toBe(60);
  });
  it('ended long ago, and other states', () => {
    expect(pollIntervalSec({ ...base, subscription: { status: 'CLOSED', expiresAt: new Date(NOW + 30 * DAY) }, allowFlow: false })).toBe(60);
    expect(pollIntervalSec({ ...base, subscription: { status: 'ACTIVE', expiresAt: new Date(NOW - 30 * DAY) }, allowFlow: false })).toBe(60);
    expect(pollIntervalSec({ ...base, subscription: { status: 'SUSPENDED', expiresAt: new Date(NOW + DAY) }, allowFlow: false })).toBe(60);
  });
  it('no subscription is still hourly, and fastPoll false keeps the normal schedule', () => {
    expect(pollIntervalSec({ ...base, subscription: null, allowFlow: false })).toBe(3600);
    expect(pollIntervalSec({ ...base, fastPoll: false, subscription: { status: 'ACTIVE', expiresAt: new Date(NOW + 30 * DAY) }, allowFlow: true })).toBe(86400);
  });
});
