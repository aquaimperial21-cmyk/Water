// Plan length: labels and term math. Plans are whole calendar months
// (`durationMonths`: 1, 3, 6, 12…); monthlyPricePaise is a true per-month rate.

/** What one full term costs, exactly as the server charges it. */
export function termPricePaise(monthlyPricePaise: number, months: number): number {
  return monthlyPricePaise * months;
}

/** Tab name: 'Monthly' | '3 months' | 'Annual' (12) | 'N months'. */
export function planLabel(months: number): string {
  return months === 1 ? 'Monthly' : months === 12 ? 'Annual' : `${months} months`;
}

/** Length as a noun: '1 month' | '6 months'. */
export function termLength(months: number): string {
  return `${months} month${months === 1 ? '' : 's'}`;
}

/** '1-month plan' | '6-month plan' | '12-month plan'. */
export function planTermLabel(months: number): string {
  return `${months}-month plan`;
}

/** How often a renewal charges: 'every month' | 'every 6 months' | 'every year'. */
export function cycleLabel(months: number): string {
  return months === 1 ? 'every month' : months === 12 ? 'every year' : `every ${months} months`;
}
