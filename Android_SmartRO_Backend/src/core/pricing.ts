// Plan pricing.
//
// Plans are sold in calendar months (Plan.durationMonths): Monthly runs to the
// same date next month however long that month is, and its end date comes
// from core/time.ts addMonthsIst.
//
// `PlanCityPrice.monthlyPricePaise` is a PER-MONTH rate that already carries
// the multi-month discount (seed.ts: 5% at 3 months, 10% at 6, 15% at 12).
// A plan grants `durationMonths` of service, so charging the monthly rate once
// for a 12-month plan hands over a year for a month's rent. Every place that
// turns a plan into an amount must go through here.

import { addMonthsIst, istDayOfMonth } from './time';

/** What the customer owes for one full term of this plan. */
export function termPricePaise(monthlyPricePaise: number, durationMonths: number): number {
  return monthlyPricePaise * Math.max(1, durationMonths);
}

/**
 * Dates for a subscription starting now on a plan of `durationMonths`.
 * Lock-in is the plan's own term: a 1-month plan locks in for 1 month, a
 * 6-month plan for 6. It used to be a flat 180 days whatever was sold.
 */
export function firstTermDates(startedAt: Date, durationMonths: number) {
  const expiresAt = addMonthsIst(startedAt, durationMonths);
  const trialDays = Number(process.env.TRIAL_DAYS ?? 7);
  return {
    startedAt,
    expiresAt,
    lockInUntil: expiresAt,
    trialEndsAt: new Date(startedAt.getTime() + trialDays * 24 * 60 * 60 * 1000),
  };
}

/**
 * New expiry after paying for one more term: from the current expiry if the
 * plan is still running, else from now. Anchored to the day the plan started
 * so a plan from the 31st that was squeezed to 28 Feb renews to 31 Mar.
 */
export function renewedExpiry(
  sub: { expiresAt: Date; startedAt: Date },
  durationMonths: number,
  now = new Date()
): Date {
  const base = sub.expiresAt > now ? sub.expiresAt : now;
  return addMonthsIst(base, durationMonths, istDayOfMonth(sub.startedAt));
}

/**
 * Expiry and status after a paid term lands (recharge, autopay debit). A
 * paused plan's clock stopped at `pausedAt`, so the term is added as of then
 * and the plan stays PAUSED: resume later shifts expiry by the time spent
 * paused. Settling used to flip a paused plan back to ACTIVE.
 */
export function applyPaidTerm(
  sub: { expiresAt: Date; startedAt: Date; status: string; pausedAt: Date | null },
  durationMonths: number,
  now = new Date()
): { expiresAt: Date; status: 'ACTIVE' | 'PAUSED' } {
  if (sub.status === 'PAUSED') {
    return { expiresAt: renewedExpiry(sub, durationMonths, sub.pausedAt ?? now), status: 'PAUSED' };
  }
  return { expiresAt: renewedExpiry(sub, durationMonths, now), status: 'ACTIVE' };
}
