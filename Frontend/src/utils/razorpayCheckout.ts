// Android / iOS: Razorpay's native SDK via react-native-razorpay.
// Needs a dev or preview build (not Expo Go). The browser build uses
// razorpayCheckout.web.ts instead; keep both exporting openRazorpayCheckout.

import { Platform } from 'react-native';
import RazorpayCheckout, { type RazorpayNativeError, type RazorpayErrorInner } from 'react-native-razorpay';
import {
  CHECKOUT_BRAND,
  CHECKOUT_THEME_COLOR,
  PaymentCancelledError,
  PaymentFailedError,
  PaymentUnconfirmedError,
  type CheckoutOptions,
  type CheckoutSuccess,
} from './checkoutTypes';

// The two SDKs number their errors differently: cancel is 0 on Android and
// 2 on iOS, and network error is the other way round.
const CANCELLED_CODE = Platform.OS === 'android' ? 0 : 2;
const NETWORK_CODE = Platform.OS === 'android' ? 2 : 0;

// When the open in flight started (0: none). The SDK returns without ever
// settling its promise when there is no Activity, so an open older than this
// is taken as abandoned rather than locking payments out for good.
const STALE_OPEN_MS = 10 * 60 * 1000;
let openedAt = 0;

function innerError(e: RazorpayNativeError): RazorpayErrorInner | undefined {
  try {
    const parsed = JSON.parse(e.description) as { error?: RazorpayErrorInner };
    if (parsed?.error) return parsed.error;
  } catch {
    // Not JSON: iOS, or an SDK-level error with a plain message.
  }
  return e.error ?? e.details?.error;
}

export async function openRazorpayCheckout(opts: CheckoutOptions): Promise<CheckoutSuccess> {
  // The SDK drops every listener on its first event, so a second open while
  // one is showing would leave the first promise hanging.
  if (openedAt && Date.now() - openedAt < STALE_OPEN_MS) {
    throw new PaymentFailedError('A payment is already open.');
  }
  const started = Date.now();
  openedAt = started;
  try {
    const res = await RazorpayCheckout.open({
      key: opts.keyId,
      order_id: opts.orderId,
      amount: opts.amountPaise,
      currency: opts.currency,
      name: CHECKOUT_BRAND,
      description: opts.description,
      prefill: opts.prefill,
      theme: { color: CHECKOUT_THEME_COLOR },
    });
    // "Success" with nothing to verify: the money may have moved, so let the
    // server look the order up rather than call it either way here.
    if (!res.razorpay_order_id || !res.razorpay_payment_id || !res.razorpay_signature) {
      throw new PaymentUnconfirmedError();
    }
    return {
      razorpay_order_id: res.razorpay_order_id,
      razorpay_payment_id: res.razorpay_payment_id,
      razorpay_signature: res.razorpay_signature,
    };
  } catch (err) {
    if (err instanceof PaymentFailedError || err instanceof PaymentUnconfirmedError) throw err;
    const e = err as RazorpayNativeError;
    const inner = innerError(e);
    // A declined attempt usually ends with the cancel code once the customer
    // backs out; the reason says whether a payment had actually failed.
    if (e.code === CANCELLED_CODE && (!inner?.reason || inner.reason === 'payment_cancelled')) {
      throw new PaymentCancelledError();
    }
    if (e.code === NETWORK_CODE) {
      throw new PaymentFailedError('No connection. Check your network and try again.');
    }
    throw new PaymentFailedError(inner?.description ?? 'Payment failed');
  } finally {
    // An abandoned open that settles late must not release the next one's lock.
    if (openedAt === started) openedAt = 0;
  }
}
