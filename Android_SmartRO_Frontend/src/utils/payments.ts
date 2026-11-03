// One entry point per thing a customer pays for. Each asks the server which
// gateway is on:
//   razorpay → create an order, open Razorpay Checkout, send the signed result
//              to /payments/verify, which settles the payment.
//   stub     → the dev-only routes that mark the payment paid without a gateway.
//
// Once Razorpay may hold the money, no single failed call decides the outcome:
// a verify that keeps failing, an SDK "cancel" and a success with no signature
// all end in Payments.sync, where the server asks Razorpay about the order.
//
// Throws PaymentCancelledError when the customer closes Checkout, and
// PaymentFailedError when Razorpay declines. Anything else is an API error.

import type { AxiosError } from 'axios';
import { Bookings, Payments, Subscriptions } from '../api/endpoints';
import { useAuthStore } from '../store/auth';
import { openRazorpayCheckout } from './razorpayCheckout';
import {
  PaymentCancelledError,
  PaymentFailedError,
  PaymentUnconfirmedError,
  type CheckoutSuccess,
} from './checkoutTypes';

export { PaymentCancelledError, PaymentFailedError } from './checkoutTypes';

/**
 * 'paid'    — settled; the plan is active.
 * 'pending' — Razorpay has (or may have) the money but our server has not
 *             recorded it yet. The payment.captured webhook settles it shortly.
 */
export type PaymentOutcome = 'paid' | 'pending';

interface Order {
  keyId: string;
  // May repeat across attempts: the server reuses an unpaid order.
  orderId: string;
  amount: number;
  currency: string;
}

// Wait before each /payments/verify attempt once Checkout has succeeded.
const VERIFY_DELAYS_MS = [0, 1500, 4000];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function prefill() {
  const u = useAuthStore.getState().user;
  return {
    name: u?.fullName ?? undefined,
    contact: u?.phone ?? undefined,
    email: u?.email ?? undefined,
  };
}

// The one verify answer that retrying cannot change.
function isBadSignature(e: unknown): boolean {
  const res = (e as AxiosError<{ error?: { code?: string } }> | undefined)?.response;
  return res?.status === 400 && res.data?.error?.code === 'BAD_SIGNATURE';
}

/** Has the server, after asking Razorpay, settled this order? Errors read as "not yet". */
async function settledOnServer(orderId: string): Promise<boolean> {
  try {
    return (await Payments.sync(orderId)).settled;
  } catch {
    return false;
  }
}

async function confirmOnServer(orderId: string): Promise<PaymentOutcome> {
  return (await settledOnServer(orderId)) ? 'paid' : 'pending';
}

async function verifyWithRetry(orderId: string, result: CheckoutSuccess): Promise<PaymentOutcome> {
  for (const delay of VERIFY_DELAYS_MS) {
    if (delay) await sleep(delay);
    try {
      await Payments.verify(result);
      return 'paid';
    } catch (e) {
      if (isBadSignature(e)) {
        throw new PaymentFailedError(
          "We couldn't confirm this payment with Razorpay. If money left your account it is refunded automatically.",
          { maybeCharged: true }
        );
      }
      // Anything else (5xx, 401, timeout) is our side: the charge stands.
    }
  }
  return confirmOnServer(orderId);
}

async function checkoutAndVerify(order: Order, description: string): Promise<PaymentOutcome> {
  let result: CheckoutSuccess;
  try {
    result = await openRazorpayCheckout({
      keyId: order.keyId,
      orderId: order.orderId,
      amountPaise: order.amount,
      currency: order.currency,
      description,
      prefill: prefill(),
    });
  } catch (e) {
    if (e instanceof PaymentUnconfirmedError) return confirmOnServer(order.orderId);
    // The Android SDK reports some UPI-intent payments that went through as
    // cancelled, and a reused order may already be paid by an earlier
    // attempt. Ask Razorpay once before telling the customer it didn't work.
    if (
      (e instanceof PaymentCancelledError || e instanceof PaymentFailedError) &&
      (await settledOnServer(order.orderId))
    ) {
      return 'paid';
    }
    throw e;
  }
  return verifyWithRetry(order.orderId, result);
}

export async function payForBooking(bookingId: string, description: string): Promise<PaymentOutcome> {
  const { driver } = await Payments.config();
  if (driver !== 'razorpay') {
    await Bookings.pay(bookingId);
    return 'paid';
  }
  const order = await Payments.createBookingOrder(bookingId);
  return checkoutAndVerify(order, description);
}

export async function payRecharge(
  subscriptionId: string,
  description: string,
  planId?: string
): Promise<PaymentOutcome> {
  const { driver } = await Payments.config();
  if (driver !== 'razorpay') {
    await Subscriptions.recharge(subscriptionId, planId);
    return 'paid';
  }
  const order = await Payments.createRechargeOrder(subscriptionId, planId);
  return checkoutAndVerify(order, description);
}
