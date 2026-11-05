// Indian time, independent of where the server runs.
//
// Install slots used to be built with `date.setHours(9)` on the host clock.
// The Dockerfile sets no TZ, so containers run UTC and a "9:00" slot became
// 14:30 IST; the 17:00 window landed at 22:30, and its 4-hour end crossed
// midnight. Customers were offered install windows that no technician works.

const IST_OFFSET_MINUTES = 5 * 60 + 30;

/**
 * The UTC instant of `hour:00` IST, on the IST calendar day that `reference`
 * falls on, shifted by `addDays`.
 */
export function istSlotStart(reference: Date, addDays: number, hour: number): Date {
  // Shift into IST so getUTC* reads the Indian calendar date.
  const ist = new Date(reference.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate() + addDays;
  // Build the instant back in UTC: IST midnight is 18:30 UTC the day before.
  return new Date(Date.UTC(y, m, d, hour, 0, 0, 0) - IST_OFFSET_MINUTES * 60 * 1000);
}

const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Day of the month (1-31) this instant falls on in IST. */
export function istDayOfMonth(date: Date): number {
  return new Date(date.getTime() + IST_OFFSET_MS).getUTCDate();
}

/**
 * `months` calendar months after `date` on the Indian calendar, at the same
 * time of day. Plans are sold in months, not day counts: IST 15 Jan → 15 Feb,
 * and a date past the end of the target month lands on its last day
 * (31 Jan → 28 Feb, or 29 Feb in a leap year).
 *
 * `anchorDay` undoes that squeeze on renewals: a plan started on the 31st
 * that was clamped to 28 Feb renews to 31 Mar, not 28 Mar. It only applies
 * when `date` is the last day of its month and earlier than the anchor.
 */
export function addMonthsIst(date: Date, months: number, anchorDay?: number): Date {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  let day = ist.getUTCDate();
  if (anchorDay && anchorDay > day && day === daysInMonth(y, m)) day = anchorDay;
  const targetMonth = m + months; // Date.UTC rolls months past 11 into the next year
  const targetYear = y + Math.floor(targetMonth / 12);
  const normalisedMonth = ((targetMonth % 12) + 12) % 12;
  const clamped = Math.min(day, daysInMonth(targetYear, normalisedMonth));
  const out = Date.UTC(
    targetYear,
    normalisedMonth,
    clamped,
    ist.getUTCHours(),
    ist.getUTCMinutes(),
    ist.getUTCSeconds(),
    ist.getUTCMilliseconds()
  );
  return new Date(out - IST_OFFSET_MS);
}

/** Format an instant for an Indian reader, e.g. "Thu, 17 Sep, 9:00 am". */
export function formatIst(date: Date, opts: Intl.DateTimeFormatOptions = {}): string {
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', ...opts });
}

/**
 * The IST calendar date alone, e.g. "17 Sept 2026", for customer-facing text.
 * `toDateString()` printed the host's day ("Thu Sep 17 2026"), which is the
 * day before in IST for anything after 18:30 UTC.
 */
export function formatIstDate(date: Date): string {
  return formatIst(date, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Hour of the day (0-23) that this instant falls on in IST. */
export function istHour(date: Date): number {
  return Number(
    date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false })
  );
}
