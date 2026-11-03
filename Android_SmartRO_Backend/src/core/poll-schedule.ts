// How long a purifier's ESP32 waits before its next GET /devices/:serial/state.
//
// The chip caches expiresAt and closes the valve by itself at that time, even
// with no internet, so polling is not what stops the water on time. A poll
// only brings news: a recharge, or an admin stopping the plan. So:
//
// - No subscription attached: once an hour.
// - Plan running (ACTIVE or GRACE, water allowed): once an hour while more
//   than 3 days are left, every 15 minutes in the last 3 days (the reminder
//   window). One check is also timed for just after the end, so a recharge
//   made shortly before expiry is seen about 5 s after the end (the chip
//   closes the valve at the end time, so water pauses for a few seconds).
// - Plan ended, waiting for a recharge: every minute for the first day, so
//   water comes back within a minute of the customer paying; every 5 minutes
//   up to a week; every 15 minutes after that, so a purifier left plugged in
//   after the customer stopped paying doesn't check every minute forever.
//   A missing or unreadable end date counts as ended long ago.
// - PAUSED: every 5 minutes. Anything else (SUSPENDED, CLOSED, TRIAL, ...):
//   every 30 minutes.
//
// The firmware clamps whatever we send to 30..3600 seconds, so every answer
// is a whole number of seconds inside that range.

const DAY_SEC = 24 * 60 * 60;

/** The firmware's range; never ask for less or more. */
export const POLL_MIN_SEC = 30;
export const POLL_MAX_SEC = 3600;

export const POLL_NO_SUBSCRIPTION_SEC = 3600;
export const POLL_RUNNING_SEC = 3600;
export const POLL_REMINDER_WINDOW_SEC = 900;
/** Inside this many seconds of the end, a running plan polls every 15 minutes. */
export const REMINDER_WINDOW_SEC = 3 * DAY_SEC;
/** The end-time check lands this many seconds after the plan ends. */
export const POLL_AFTER_END_MARGIN_SEC = 5;

/** Ended less than a day ago. */
export const POLL_JUST_ENDED_SEC = 60;
/** Ended between a day and a week ago. */
export const POLL_ENDED_DAYS_SEC = 300;
/** Ended more than a week ago, or the end date is unknown. */
export const POLL_ENDED_LONG_SEC = 900;
export const JUST_ENDED_WINDOW_SEC = DAY_SEC;
export const ENDED_DAYS_WINDOW_SEC = 7 * DAY_SEC;

export const POLL_PAUSED_SEC = 300;
export const POLL_OTHER_SEC = 1800;

/**
 * DEVICE_GRACE_DAYS as a usable number: a finite value above 0, else 0.
 * A typo like "2 days" must not become NaN, which would turn the water off on
 * every purifier.
 */
export function parseGraceDays(raw: string | undefined): number {
  const days = Number(raw ?? 0);
  return Number.isFinite(days) && days > 0 ? days : 0;
}

export interface PollScheduleInput {
  /** The subscription attached to the device, or null when there is none. */
  subscription: { status: string; expiresAt: Date | string | number | null | undefined } | null | undefined;
  /** Whether the state response lets water flow (the handler's own decision). */
  allowFlow: boolean;
  /** Days of water after expiresAt (DEVICE_GRACE_DAYS). */
  graceDays: number;
  /** Current time, in epoch milliseconds. */
  now: number;
}

/** Seconds the device should wait before its next state poll. Never throws. */
export function pollIntervalSec({ subscription, allowFlow, graceDays, now }: PollScheduleInput): number {
  if (!subscription) return toFirmwareRange(POLL_NO_SUBSCRIPTION_SEC);

  const { status } = subscription;
  if (status === 'PAUSED') return toFirmwareRange(POLL_PAUSED_SEC);
  if (status !== 'ACTIVE' && status !== 'GRACE') return toFirmwareRange(POLL_OTHER_SEC);

  const days = Number.isFinite(graceDays) && graceDays > 0 ? graceDays : 0;
  const graceEndMs = toMs(subscription.expiresAt) + days * DAY_SEC * 1000;
  const secondsLeft = (graceEndMs - now) / 1000;

  // No readable end date: treat the plan as ended, and as ended long ago.
  if (!Number.isFinite(secondsLeft)) return toFirmwareRange(POLL_ENDED_LONG_SEC);

  if (allowFlow) {
    const base = secondsLeft > REMINDER_WINDOW_SEC ? POLL_RUNNING_SEC : POLL_REMINDER_WINDOW_SEC;
    const atEnd = Math.ceil(secondsLeft) + POLL_AFTER_END_MARGIN_SEC;
    return toFirmwareRange(Math.min(base, atEnd));
  }

  const secondsSinceEnd = -secondsLeft;
  if (secondsSinceEnd < JUST_ENDED_WINDOW_SEC) return toFirmwareRange(POLL_JUST_ENDED_SEC);
  if (secondsSinceEnd <= ENDED_DAYS_WINDOW_SEC) return toFirmwareRange(POLL_ENDED_DAYS_SEC);
  return toFirmwareRange(POLL_ENDED_LONG_SEC);
}

/** Epoch ms of a date-ish value; NaN when it is missing or unreadable. */
function toMs(value: Date | string | number | null | undefined): number {
  // new Date(null) is 1970, not invalid, so missing values are caught first.
  if (value === null || value === undefined) return NaN;
  return new Date(value).getTime();
}

/** A whole number of seconds inside the firmware's 30..3600 range. */
function toFirmwareRange(sec: number): number {
  if (!Number.isFinite(sec)) return POLL_MAX_SEC;
  return Math.min(POLL_MAX_SEC, Math.max(POLL_MIN_SEC, Math.ceil(sec)));
}
