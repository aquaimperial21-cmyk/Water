// Plan pricing.
//
// `PlanCityPrice.monthlyPricePaise` is a PER-MONTH rate that already carries
// the multi-month discount (seed.ts: 5% at 3 months, 10% at 6, 15% at 12).
// A plan grants `durationDays` of service, so charging the monthly rate once
// for a 365-day plan hands over a year for a month's rent. Every place that
// turns a plan into an amount must go through here.

/** Whole months in a plan term: 30d → 1, 90d → 3, 180d → 6, 365d → 12. */
export function planMonths(durationDays: number): number {
  return Math.max(1, Math.round(durationDays / 30));
}

/** What the customer owes for one full term of this plan. */
export function termPricePaise(monthlyPricePaise: number, durationDays: number): number {
  return monthlyPricePaise * planMonths(durationDays);
}
