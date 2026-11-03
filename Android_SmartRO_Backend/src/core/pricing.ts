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
//
// Test products (Product.tag TEST, e.g. "TEST Purifier ₹1") are the exception
// to calendar months: every paid term is exactly one minute, whatever plan was
// bought, so pay → water on → water off can be tried in minutes. The price is
// still the normal termPricePaise. Every payment path (stub, Razorpay verify,
// order sync, webhooks) gets its dates from firstTermDates / applyPaidTerm
// below, which is the only place this rule lives.

import { TEST_PRODUCT_TAG } from './poll-schedule';
import { addMonthsIst, istDayOfMonth } from './time';

/** One paid term of a test product (tag TEST). */
export const TEST_TERM_MS = 60 * 1000;

/** The product's tag (Product.tag). Only TEST changes how long a term is. */
export type TermProductTag = string | null | undefined;

/** Whether this product tag marks an internal test product with 1-minute terms. */
export function isTestProduct(productTag: TermProductTag): boolean {
  return productTag === TEST_PRODUCT_TAG;
}

/** What the customer owes for one full term of this plan. */
export function termPricePaise(monthlyPricePaise: number, durationMonths: number): number {
  return monthlyPricePaise * Math.max(1, durationMonths);
}

/**
 * Dates for a subscription starting now on a plan of `durationMonths`.
 * Lock-in is the plan's own term: a 1-month plan locks in for 1 month, a
 * 6-month plan for 6. It used to be a flat 180 days whatever was sold.
 * A test product's term is one minute, and its trial ends with it.
 */
export function firstTermDates(startedAt: Date, durationMonths: number, productTag: TermProductTag) {
  const trialDays = Number(process.env.TRIAL_DAYS ?? 7);
  const trialEndsAt = new Date(startedAt.getTime() + trialDays * 24 * 60 * 60 * 1000);
  if (isTestProduct(productTag)) {
    const expiresAt = new Date(startedAt.getTime() + TEST_TERM_MS);
    return { startedAt, expiresAt, lockInUntil: expiresAt, trialEndsAt: trialEndsAt < expiresAt ? trialEndsAt : expiresAt };
  }
  const expiresAt = addMonthsIst(startedAt, durationMonths);
  return { startedAt, expiresAt, lockInUntil: expiresAt, trialEndsAt };
}

/**
 * New expiry after paying for one more term: from the current expiry if the
 * plan is still running, else from now. Anchored to the day the plan started
 * so a plan from the 31st that was squeezed to 28 Feb renews to 31 Mar.
 * A test product gets one minute on top of the same base.
 */
export function renewedExpiry(
  sub: { expiresAt: Date; startedAt: Date },
  durationMonths: number,
  productTag: TermProductTag,
  now = new Date()
): Date {
  const base = sub.expiresAt > now ? sub.expiresAt : now;
  if (isTestProduct(productTag)) return new Date(base.getTime() + TEST_TERM_MS);
  return addMonthsIst(base, durationMonths, istDayOfMonth(sub.startedAt));
}

/**
 * The subscription fields to write when a paid term lands (recharge, autopay
 * debit): one more term (see renewedExpiry), and the plan is ACTIVE again
 * whatever state it was in (GRACE, SUSPENDED, or a legacy PAUSED row from
 * before the pause feature was removed on 2026-11-04, whose pausedAt is
 * cleared). Spread the result into the update so no path forgets a field.
 */
export function applyPaidTerm(
  sub: { expiresAt: Date; startedAt: Date },
  durationMonths: number,
  productTag: TermProductTag,
  now = new Date()
): { expiresAt: Date; status: 'ACTIVE'; pausedAt: null } {
  return { expiresAt: renewedExpiry(sub, durationMonths, productTag, now), status: 'ACTIVE', pausedAt: null };
}
