// What a subscription means to the customer right now: which state it is in,
// what the status card says, and which actions the server will accept.
//
// Pure functions of (subscription, now) — no React, no network. The server
// only ever sends status ACTIVE | PAUSED | CLOSED and never flips a status at
// expiry, so "expired" (water off) is derived here: ACTIVE with expiresAt <= now.

import type { AutopayStatus, Subscription, SubscriptionRefund } from '../api/endpoints';
import { formatDate, paiseToInr } from './format';
import { planTermLabel, termLength } from './plans';

export type PlanKind = 'awaitingInstall' | 'active' | 'expiring' | 'expired' | 'paused' | 'closed';

/** Subset of the Pill tones the plan states use. */
export type PlanTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
/** "Ends soon" once this many days (or fewer) are left. */
export const EXPIRING_DAYS = 7;

const ms = (iso: string | null | undefined): number => (iso ? new Date(iso).getTime() : NaN);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/* ─────────────────────────── Dates ─────────────────────────── */

/**
 * Adds whole calendar months on the device clock, clamping to the last day of
 * the target month (31 Jan + 1 month → 28/29 Feb). Negative months subtract.
 */
export function addCalendarMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

/**
 * Whole calendar days from today to `end` on the device clock: a plan ending
 * 12 Nov reads '10 days' all day on 2 Nov, not 9 because a few minutes have
 * passed. Rounded so a DST shift can't knock it off by one.
 */
function calendarDaysUntil(end: Date, now: Date): number {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return Math.round((b - a) / DAY_MS);
}

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** '3 Nov', or '3 Nov 2027' outside the current year. */
export function shortDate(d: Date, now: Date): string {
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

function shortTime(d: Date): string {
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

/** 'today' | 'tomorrow' | 'yesterday' | 'on 3 Nov' — reads after a verb. */
function onDay(d: Date, now: Date): string {
  if (sameLocalDay(d, now)) return 'today';
  const tomorrow = new Date(now.getTime());
  tomorrow.setDate(now.getDate() + 1);
  if (sameLocalDay(d, tomorrow)) return 'tomorrow';
  const yesterday = new Date(now.getTime());
  yesterday.setDate(now.getDate() - 1);
  if (sameLocalDay(d, yesterday)) return 'yesterday';
  return `on ${shortDate(d, now)}`;
}

/* ─────────────────────────── State ─────────────────────────── */

/** ACTIVE but past its end date: the device has stopped the water. */
export function isExpired(sub: Subscription, now: Date): boolean {
  return sub.status === 'ACTIVE' && ms(sub.expiresAt) <= now.getTime();
}

export function planKind(sub: Subscription, now: Date): PlanKind {
  if (sub.status === 'CLOSED') return 'closed';
  if (sub.status === 'PAUSED') return 'paused';
  const left = ms(sub.expiresAt) - now.getTime();
  if (!(left > 0)) return 'expired';
  if (sub.booking?.status !== 'INSTALLED' && !sub.device) return 'awaitingInstall';
  return left <= EXPIRING_DAYS * DAY_MS ? 'expiring' : 'active';
}

const KIND_RANK: Record<PlanKind, number> = {
  awaitingInstall: 0,
  active: 0,
  expiring: 0,
  paused: 1,
  expired: 2,
  closed: 3,
};

/**
 * The subscription My Plan opens on: running plans (incl. awaiting install)
 * first, then paused, then expired, then closed; newest first within each.
 */
export function pickDefaultSubscription(subs: Subscription[], now: Date): Subscription | null {
  if (subs.length === 0) return null;
  const ranked = subs.map((s, i) => ({ s, i, rank: KIND_RANK[planKind(s, now)], started: ms(s.startedAt) || 0 }));
  ranked.sort((a, b) => a.rank - b.rank || b.started - a.started || a.i - b.i);
  return ranked[0]!.s;
}

/** Months in one term of the subscription's plan (at least 1). */
export function planMonths(sub: Subscription): number {
  return Math.max(1, sub.plan?.durationMonths ?? 1);
}

/**
 * Start of the term the customer is in now: one plan term before expiresAt,
 * never before the subscription started. Renewals don't reset startedAt, so
 * measuring from it would stretch the ring over every past term.
 */
export function currentCycleStart(sub: Subscription): Date {
  const termStart = addCalendarMonths(new Date(sub.expiresAt), -planMonths(sub));
  const started = new Date(sub.startedAt);
  return termStart.getTime() > started.getTime() ? termStart : started;
}

/** The end date a recharge would give: one term on top of a running plan, else from now. */
export function rechargeEndDate(sub: Subscription, now: Date): Date {
  const expires = new Date(sub.expiresAt);
  const base = expires.getTime() > now.getTime() ? expires : now;
  return addCalendarMonths(base, planMonths(sub));
}

/** The end date after resuming now: the paused time is added back. */
export function resumeEndDate(sub: Subscription, now: Date): Date | null {
  if (sub.status !== 'PAUSED' || !sub.pausedAt) return null;
  const pausedFor = Math.max(0, now.getTime() - ms(sub.pausedAt));
  return new Date(ms(sub.expiresAt) + pausedFor);
}

/** Time left on the plan; frozen at the moment of pausing while PAUSED. */
function remainingMs(sub: Subscription, kind: PlanKind, now: Date): number {
  if (kind === 'expired' || kind === 'closed') return 0;
  const from = kind === 'paused' && sub.pausedAt ? ms(sub.pausedAt) : now.getTime();
  return Math.max(0, ms(sub.expiresAt) - from);
}

export function refundText(refund: SubscriptionRefund): string {
  return refund.status === 'SUCCESS'
    ? `Refunded ${paiseToInr(refund.amountPaise)}`
    : `Refund ${paiseToInr(refund.amountPaise)} in progress`;
}

const VISIT_LABEL: Record<string, string> = {
  INSTALL: 'Installation',
  SERVICE: 'Service visit',
  FILTER: 'Filter change',
  PICKUP: 'Purifier pickup',
};

/* ─────────────────────────── View model ─────────────────────────── */

export type PlanRowIcon = 'renew' | 'end' | 'lock' | 'visit' | 'pause' | 'refund';
export interface PlanRow { key: string; icon: PlanRowIcon; label: string; value: string }

export interface PlanAction {
  visible: boolean;
  enabled: boolean;
  label: string;
  /** Why it is disabled, in words the customer can act on. */
  reason: string | null;
}

export type CancelMode = 'trial' | 'postLockIn' | 'locked';
export type AutopayOp = 'create' | 'cancel' | 'resume';

export interface PlanActions {
  primary: 'recharge' | 'resume' | 'installSlot' | null;
  recharge: PlanAction;
  resume: PlanAction;
  pause: PlanAction;
  installSlot: PlanAction;
  cancel: PlanAction & { mode: CancelMode | null; refundPaise: number };
  autopay: PlanAction & { op: AutopayOp | null; note: string | null; warn: boolean };
  smartHealth: PlanAction;
  waterTest: PlanAction;
}

export interface PlanView {
  kind: PlanKind;
  pill: { label: string; tone: PlanTone };
  headline: string;
  ring: { progress: number; label: string; caption: string };
  /** '12 days left' · 'Ends today' · '5 hours left' · 'Ended on 3 Nov'. */
  daysLeftText: string;
  /** '1-month plan' etc.; null where a term means nothing (closed). */
  cycleText: string | null;
  cycleStart: Date;
  rows: PlanRow[];
  trial: { endsAt: Date; refundPaise: number; text: string } | null;
  refund: { text: string; done: boolean } | null;
  actions: PlanActions;
  /** End date a recharge made now would give — for the confirm dialog. */
  rechargeEndsAt: Date;
  /** End date a resume made now would give; null unless paused. */
  resumeEndsAt: Date | null;
}

export interface PlanViewOptions {
  /** false when the server runs the stub gateway (autopay answers 409); null = unknown. */
  autopayAvailable: boolean | null;
}

const hidden: PlanAction = { visible: false, enabled: false, label: '', reason: null };
const shown = (label: string, reason: string | null = null): PlanAction => ({
  visible: true,
  enabled: reason === null,
  label,
  reason,
});

function autopayAction(
  sub: Subscription,
  kind: PlanKind,
  opts: PlanViewOptions,
): PlanActions['autopay'] {
  const status: AutopayStatus | null = sub.autopayStatus ?? null;
  const none = { ...hidden, op: null, note: null, warn: false };

  // A mandate we could not stop can still debit the customer — say so in
  // every state, closed included.
  if (status === 'CANCEL_FAILED') {
    return {
      ...none,
      note: "We couldn't stop your autopay mandate. Contact support so you aren't charged again.",
      warn: true,
    };
  }
  if (kind === 'closed') return none;
  if (opts.autopayAvailable === false) {
    return { ...none, note: 'Autopay is not available yet. Recharge manually before your plan ends.' };
  }
  if (kind === 'paused') {
    // Paused with the plan; it comes back on resume. Status only.
    const label = status === 'PAUSED' || status === 'ACTIVE' ? 'Autopay paused' : 'No autopay';
    return {
      ...shown(label, status === 'PAUSED' || status === 'ACTIVE'
        ? 'Autopay resumes when you resume the plan.'
        : 'Resume the plan to set up autopay.'),
      op: null,
      note: null,
      warn: false,
    };
  }
  switch (status) {
    case 'CREATED':
      return { ...shown('Finish autopay setup'), op: 'create', note: "Autopay isn't on yet: the authorisation wasn't finished.", warn: false };
    case 'ACTIVE':
      return { ...shown('Autopay on'), op: 'cancel', note: null, warn: false };
    case 'PAUSED':
      return { ...shown('Autopay paused'), op: 'resume', note: 'Autopay is paused. Tap it to turn renewals back on.', warn: false };
    case 'PENDING':
      return {
        ...shown('Autopay retrying', 'A renewal debit failed and Razorpay is retrying it.'),
        op: null,
        note: 'A renewal debit failed and Razorpay is retrying it. Keep enough balance, or recharge manually.',
        warn: true,
      };
    case 'HALTED':
      return {
        ...shown('Set up autopay'),
        op: 'create',
        note: 'Autopay stopped after repeated failed debits. Set it up again or recharge manually.',
        warn: true,
      };
    default: // CANCELLED | COMPLETED | null
      return { ...shown('Set up autopay'), op: 'create', note: null, warn: false };
  }
}

export function planView(sub: Subscription, now: Date, opts: PlanViewOptions): PlanView {
  const kind = planKind(sub, now);
  const nowMs = now.getTime();
  const expires = new Date(sub.expiresAt);
  const lockIn = new Date(sub.lockInUntil);
  const pausedAt = sub.pausedAt ? new Date(sub.pausedAt) : null;
  const cycleStart = currentCycleStart(sub);
  const months = planMonths(sub);
  const autopayOn = sub.autopayStatus === 'ACTIVE';
  const booking = sub.booking;

  /* Pill */
  const pill: PlanView['pill'] = {
    awaitingInstall: { label: 'Awaiting install', tone: 'accent' as const },
    active: { label: 'Active', tone: 'success' as const },
    expiring: { label: 'Ends soon', tone: 'warning' as const },
    expired: { label: 'Expired', tone: 'danger' as const },
    paused: { label: 'Paused', tone: 'neutral' as const },
    closed: { label: sub.cancelledAt ? 'Cancelled' : 'Closed', tone: 'neutral' as const },
  }[kind];

  /* Ring + days left */
  const remaining = remainingMs(sub, kind, now);
  const cycleMs = Math.max(1, expires.getTime() - cycleStart.getTime());
  const progress = Math.max(0, Math.min(1, remaining / cycleMs));
  // Paused: a duration kept for later. Otherwise: calendar days to the end date.
  const days = kind === 'paused' ? Math.round(remaining / DAY_MS) : calendarDaysUntil(expires, now);
  const hours = Math.max(1, Math.ceil(remaining / HOUR_MS));
  const endedOn = kind === 'closed' && sub.cancelledAt ? new Date(sub.cancelledAt) : expires;

  let ring: PlanView['ring'];
  let daysLeftText: string;
  if (kind === 'expired' || kind === 'closed') {
    ring = { progress: 0, label: '0', caption: kind === 'closed' ? 'ENDED' : 'DAYS LEFT' };
    daysLeftText = `Ended ${onDay(endedOn, now)}`;
  } else if (days >= 1) {
    ring = { progress, label: String(days), caption: days === 1 ? 'DAY LEFT' : 'DAYS LEFT' };
    daysLeftText = kind === 'paused' ? `${plural(days, 'day')} kept while paused` : `${plural(days, 'day')} left`;
  } else {
    ring = { progress, label: String(hours), caption: hours === 1 ? 'HOUR LEFT' : 'HOURS LEFT' };
    daysLeftText = kind === 'paused'
      ? `${plural(hours, 'hour')} kept while paused`
      : sameLocalDay(expires, now) ? 'Ends today' : `${plural(hours, 'hour')} left`;
  }

  const cycleText = kind === 'closed'
    ? null
    : kind !== 'paused' && kind !== 'expired' && nowMs < cycleStart.getTime()
      ? 'Next term already paid'
      // The plan's own length, not a day count: a month is a month.
      : planTermLabel(months);

  /* Refund (closed plans) */
  const refund = sub.refund
    ? { text: refundText(sub.refund), done: sub.refund.status === 'SUCCESS' }
    : null;

  /* Headline */
  const nextVisit = sub.nextVisit ?? null;
  let headline: string;
  switch (kind) {
    case 'awaitingInstall':
      headline = nextVisit && nextVisit.type === 'INSTALL'
        ? `Installation booked for ${shortDate(new Date(nextVisit.scheduledFor), now)}, ${shortTime(new Date(nextVisit.scheduledFor))}. Water starts once it's set up.`
        : 'Payment received. Pick an installation slot and we will set up your purifier.';
      break;
    case 'active':
      headline = autopayOn
        ? `Water is on. Autopay renews it on ${shortDate(expires, now)}.`
        : `Water is on until ${shortDate(expires, now)}.`;
      break;
    case 'expiring':
      headline = autopayOn
        ? `Ends ${onDay(expires, now)}. Autopay renews it automatically.`
        : sub.autopayStatus === 'PENDING'
          ? `A renewal debit failed and is being retried. Water stops ${onDay(expires, now)} unless it goes through.`
          : `Water stops ${onDay(expires, now)}. Recharge to keep it flowing.`;
      break;
    case 'expired':
      headline = `Water stopped ${onDay(expires, now)}. Recharge to restore it.`;
      break;
    case 'paused':
      headline = pausedAt
        ? `Paused ${onDay(pausedAt, now)}. Water is off; the days left are added back when you resume.`
        : 'Paused. Water is off; the days left are added back when you resume.';
      break;
    case 'closed': {
      const ended = sub.cancelledAt ? `Cancelled ${onDay(endedOn, now)}.` : `Ended ${onDay(endedOn, now)}.`;
      headline = sub.refund
        ? sub.refund.status === 'SUCCESS'
          ? `${ended} ${paiseToInr(sub.refund.amountPaise)} has been refunded.`
          : `${ended} Your refund of ${paiseToInr(sub.refund.amountPaise)} is in progress.`
        : ended;
      break;
    }
  }

  /* Rows */
  const rows: PlanRow[] = [];
  if (kind === 'closed') {
    rows.push({ key: 'end', icon: 'end', label: 'Ended on', value: formatDate(endedOn) });
    if (refund) rows.push({ key: 'refund', icon: 'refund', label: 'Refund', value: refund.text });
  } else if (kind === 'paused') {
    if (pausedAt) rows.push({ key: 'paused', icon: 'pause', label: 'Paused on', value: formatDate(pausedAt) });
  } else if (kind === 'expired') {
    rows.push({ key: 'end', icon: 'end', label: 'Ended on', value: formatDate(expires) });
  } else {
    rows.push(autopayOn
      ? { key: 'renew', icon: 'renew', label: 'Renews on', value: formatDate(expires) }
      : { key: 'end', icon: 'end', label: 'Ends on', value: formatDate(expires) });
  }
  if (kind !== 'closed' && lockIn.getTime() > nowMs) {
    rows.push({ key: 'lock', icon: 'lock', label: 'Lock-in until', value: formatDate(lockIn) });
  }
  if (kind !== 'closed' && nextVisit) {
    const at = new Date(nextVisit.scheduledFor);
    rows.push({
      key: 'visit',
      icon: 'visit',
      label: 'Next visit',
      value: `${VISIT_LABEL[nextVisit.type] ?? 'Visit'} · ${formatDate(at)}`,
    });
  }

  /* Trial + cancel */
  const trialEnds = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null;
  const inTrial = kind !== 'closed' && trialEnds !== null && nowMs < trialEnds.getTime();
  const depositPaise = booking?.depositPaise ?? 0;
  const trialRefundPaise = depositPaise + (booking?.firstPaymentPaise ?? 0);
  const trial = inTrial && trialEnds
    ? {
        endsAt: trialEnds,
        refundPaise: trialRefundPaise,
        text: `Cancel by ${formatDate(trialEnds)} for a full refund of ${paiseToInr(trialRefundPaise)} (deposit + first payment).`,
      }
    : null;

  let cancel: PlanActions['cancel'];
  if (kind === 'closed') {
    cancel = { ...hidden, mode: null, refundPaise: 0 };
  } else if (inTrial) {
    cancel = { ...shown('Cancel subscription'), mode: 'trial', refundPaise: trialRefundPaise };
  } else if (nowMs >= lockIn.getTime()) {
    cancel = { ...shown('Cancel subscription'), mode: 'postLockIn', refundPaise: depositPaise };
  } else {
    cancel = {
      ...shown('Cancel subscription', `You can cancel from ${formatDate(lockIn)}, when the lock-in ends.`),
      mode: 'locked',
      refundPaise: 0,
    };
  }

  /* Actions */
  const running = kind === 'active' || kind === 'expiring';
  const canSchedule = kind === 'awaitingInstall'
    && !!booking && booking.status !== 'CANCELLED' && booking.status !== 'INSTALLED';

  const recharge: PlanAction = kind === 'closed'
    ? hidden
    : kind === 'paused'
      ? shown('Recharge', 'Resume the plan before recharging it.')
      : shown(kind === 'expired' ? 'Restore water' : kind === 'expiring' ? 'Recharge now' : 'Recharge');

  const actions: PlanActions = {
    primary: kind === 'paused'
      ? 'resume'
      : kind === 'closed'
        ? null
        : canSchedule ? 'installSlot' : 'recharge',
    recharge,
    resume: kind === 'paused' ? shown('Resume') : hidden,
    pause: running ? shown('Pause') : hidden,
    installSlot: canSchedule
      ? shown(nextVisit?.type === 'INSTALL' ? 'Change slot' : 'Pick a slot')
      : hidden,
    cancel,
    autopay: autopayAction(sub, kind, opts),
    smartHealth: running && sub.device?.serial ? shown('Smart health') : hidden,
    waterTest: running ? shown('Free water-quality test') : hidden,
  };

  return {
    kind,
    pill,
    headline,
    ring,
    daysLeftText,
    cycleText,
    cycleStart,
    rows,
    trial,
    refund,
    actions,
    rechargeEndsAt: rechargeEndDate(sub, now),
    resumeEndsAt: resumeEndDate(sub, now),
  };
}

/** One line per closed plan in "Past plans". */
export function pastPlanSummary(sub: Subscription): {
  title: string;
  ended: string;
  refund: string | null;
  refundDone: boolean;
  warning: string | null;
} {
  const endedOn = sub.cancelledAt ? new Date(sub.cancelledAt) : new Date(sub.expiresAt);
  return {
    title: `${sub.product?.name ?? 'Purifier'} · ${termLength(planMonths(sub))}`,
    ended: `${sub.cancelledAt ? 'Cancelled' : 'Ended'} ${formatDate(endedOn)}`,
    refund: sub.refund ? refundText(sub.refund) : null,
    refundDone: sub.refund?.status === 'SUCCESS',
    warning: sub.autopayStatus === 'CANCEL_FAILED'
      ? 'Autopay mandate still live. Contact support so you aren’t charged.'
      : null,
  };
}
