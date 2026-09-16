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

/** Format an instant for an Indian reader, e.g. "Thu, 17 Sep, 9:00 am". */
export function formatIst(date: Date, opts: Intl.DateTimeFormatOptions = {}): string {
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', ...opts });
}

/** Hour of the day (0-23) that this instant falls on in IST. */
export function istHour(date: Date): number {
  return Number(
    date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false })
  );
}
