// Guard for the stub payment endpoints.
//
// `POST /bookings/:id/pay` and `POST /subscriptions/:id/recharge` do not talk
// to a gateway at all: they sleep, then mark the payment SUCCESS and activate
// the plan. That is fine on a laptop and catastrophic on a deployment — any
// signed-in customer can hand themselves a paid subscription, an invoice and a
// referral reward for free. They stay available only where no real money could
// have been involved: the stub driver, outside production.

import { getPaymentDriver } from '../services/razorpay';
import { HttpError } from './errors';

export function stubPaymentsAllowed(): boolean {
  return getPaymentDriver() === 'stub' && process.env.NODE_ENV !== 'production';
}

/** Throws 503 when a stub payment route is hit on a real deployment. */
export function assertStubPaymentsAllowed(): void {
  if (stubPaymentsAllowed()) return;
  throw new HttpError(
    503,
    'PAYMENTS_UNAVAILABLE',
    'Online payment is not available on this server. Use the Razorpay checkout flow (/payments/.../order then /payments/verify).'
  );
}
