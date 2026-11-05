// Shared by razorpayCheckout.ts (native) and razorpayCheckout.web.ts (browser).

export interface CheckoutOptions {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  description: string;
  prefill?: { name?: string; contact?: string; email?: string };
}

/** The triplet Razorpay hands back on success. /payments/verify checks its signature. */
export interface CheckoutSuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/**
 * The customer closed Checkout. The Android SDK can also say this about a
 * UPI-intent payment that went through, so payments.ts asks the server first.
 */
export class PaymentCancelledError extends Error {
  constructor() {
    super('Payment cancelled');
    this.name = 'PaymentCancelledError';
  }
}

/** Razorpay declined the payment (bank failure, wrong OTP, …). */
export class PaymentFailedError extends Error {
  /** Money may have left the account, so the screen must not say "not charged". */
  readonly maybeCharged: boolean;

  constructor(message: string, opts: { maybeCharged?: boolean } = {}) {
    super(message);
    this.name = 'PaymentFailedError';
    this.maybeCharged = opts.maybeCharged ?? false;
  }
}

/**
 * Checkout reported success but handed back nothing we can verify. The money
 * may have moved, so payments.ts asks the server to look the order up instead
 * of telling the customer anything either way.
 */
export class PaymentUnconfirmedError extends Error {
  constructor() {
    super('Payment not confirmed');
    this.name = 'PaymentUnconfirmedError';
  }
}

export const CHECKOUT_BRAND = 'ImperialAqua';
export const CHECKOUT_THEME_COLOR = '#23BAFB'; // tokens.color.accent
