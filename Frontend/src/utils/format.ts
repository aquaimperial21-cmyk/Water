// Formatters are built once and reused: toLocaleString & co. build a new one
// on every call, which is slow, and these run on every render. Same locale
// and options as those calls, so the text is the same.
const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const DATE = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const DATE_TIME = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** fmt.format(date), but a bad date gives 'Invalid Date' (as toLocaleDateString does) instead of throwing. */
export function formatWith(fmt: Intl.DateTimeFormat, date: Date): string {
  return Number.isNaN(date.getTime()) ? 'Invalid Date' : fmt.format(date);
}

export function paiseToInr(paise: number): string {
  const rupees = Math.round(paise) / 100;
  return '₹' + INR.format(rupees);
}

export function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return formatWith(DATE, date);
}

export function formatDateTime(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return formatWith(DATE_TIME, date);
}

/** '5m ago' · '3h ago' · '1d ago' (whole units, never under 1m). */
export function formatAgo(atMs: number, nowMs: number = Date.now()): string {
  const mins = Math.max(1, Math.floor((nowMs - atMs) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function daysFromNow(d: string | Date): number {
  const date = typeof d === 'string' ? new Date(d) : d;
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}
