// Browser build: Razorpay's hosted checkout.js. Metro picks this file for web.

import {
  CHECKOUT_BRAND,
  CHECKOUT_THEME_COLOR,
  PaymentCancelledError,
  PaymentFailedError,
  PaymentUnconfirmedError,
  type CheckoutOptions,
  type CheckoutSuccess,
} from './checkoutTypes';

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', cb: (resp: { error?: { description?: string; reason?: string } }) => void): void;
}
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;

let scriptPromise: Promise<RazorpayCtor> | null = null;

function loadScript(): Promise<RazorpayCtor> {
  const existing = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
  if (existing) return Promise.resolve(existing);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<RazorpayCtor>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => {
      const ctor = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
      if (ctor) resolve(ctor);
      else reject(new Error('Razorpay Checkout did not load.'));
    };
    s.onerror = () => {
      // Let the next tap try again instead of caching the failure.
      scriptPromise = null;
      s.remove();
      reject(new Error('Could not load Razorpay Checkout. Check your connection and try again.'));
    };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

export async function openRazorpayCheckout(opts: CheckoutOptions): Promise<CheckoutSuccess> {
  const Razorpay = await loadScript();
  return new Promise<CheckoutSuccess>((resolve, reject) => {
    // Checkout stays open after a failed attempt so the customer can retry.
    // Remember why it failed, and report that if they then close it.
    let lastFailure: string | null = null;
    let settled = false;

    const rzp = new Razorpay({
      key: opts.keyId,
      order_id: opts.orderId,
      amount: opts.amountPaise,
      currency: opts.currency,
      name: CHECKOUT_BRAND,
      description: opts.description,
      prefill: opts.prefill,
      theme: { color: CHECKOUT_THEME_COLOR },
      handler: (resp: Partial<CheckoutSuccess>) => {
        settled = true;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = resp;
        // Same rule as native: no triplet, let the server look the order up.
        if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
          resolve({ razorpay_order_id, razorpay_payment_id, razorpay_signature });
        } else {
          reject(new PaymentUnconfirmedError());
        }
      },
      modal: {
        ondismiss: () => {
          if (settled) return;
          settled = true;
          reject(lastFailure ? new PaymentFailedError(lastFailure) : new PaymentCancelledError());
        },
      },
    });
    rzp.on('payment.failed', (resp) => {
      lastFailure = resp.error?.description ?? resp.error?.reason ?? 'Payment failed';
    });
    rzp.open();
  });
}
