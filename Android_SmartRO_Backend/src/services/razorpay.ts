// Razorpay integration: order creation + signature verification.
//
// Flow:
//   1. Server creates an Order via Razorpay REST API (amount in paise, INR).
//   2. Client opens the Razorpay Checkout with `key_id`, `order_id`, and
//      a callback that posts the `(orderId, paymentId, signature)` triplet
//      back to the server.
//   3. Server verifies HMAC-SHA256(`${orderId}|${paymentId}`, KEY_SECRET)
//      matches the client-supplied signature before crediting the payment.
//   4. Webhooks (`payment.captured`, `payment.failed`, `refund.processed`)
//      arrive at /api/v1/webhooks/razorpay; we verify the X-Razorpay-Signature
//      header (HMAC-SHA256 of the raw body with WEBHOOK_SECRET).
//
// `razorpay` package is loaded lazily so that the backend still boots when
// the driver is set to "stub" and the dependency is not installed locally.

import crypto from 'crypto';

export type RazorpayDriver = 'stub' | 'razorpay';

export function getPaymentDriver(): RazorpayDriver {
  const v = (process.env.PAYMENT_DRIVER ?? 'stub').toLowerCase();
  return v === 'razorpay' ? 'razorpay' : 'stub';
}

export interface RazorpayOrder {
  id: string;
  amount: number; // paise
  currency: string;
  receipt?: string;
  status: string;
}

export interface RazorpayPlan {
  id: string;
  item: { amount: number; currency: string; name: string };
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
}

export interface RazorpaySubscription {
  id: string;
  plan_id: string;
  status: string; // created | authenticated | active | pending | halted | cancelled | completed
  current_start: number | null;
  current_end: number | null;
  short_url?: string;
  notes?: Record<string, string>;
}

interface RazorpayClient {
  orders: {
    create(opts: {
      amount: number;
      currency: string;
      receipt?: string;
      notes?: Record<string, string>;
      payment_capture?: 0 | 1 | boolean;
    }): Promise<RazorpayOrder>;
  };
  plans: {
    create(opts: {
      period: 'daily' | 'weekly' | 'monthly' | 'yearly';
      interval: number;
      item: { name: string; amount: number; currency: string; description?: string };
      notes?: Record<string, string>;
    }): Promise<RazorpayPlan>;
  };
  subscriptions: {
    create(opts: {
      plan_id: string;
      total_count: number;
      customer_notify?: 0 | 1;
      start_at?: number;
      notes?: Record<string, string>;
      addons?: Array<{ item: { name: string; amount: number; currency: string } }>;
    }): Promise<RazorpaySubscription>;
    cancel(id: string, opts?: { cancel_at_cycle_end?: 0 | 1 }): Promise<RazorpaySubscription>;
    pause(id: string, opts?: { pause_at?: 'now' }): Promise<RazorpaySubscription>;
    resume(id: string, opts?: { resume_at?: 'now' }): Promise<RazorpaySubscription>;
  };
}

let cachedClient: RazorpayClient | null = null;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

function getClient(): RazorpayClient {
  if (cachedClient) return cachedClient;
  const keyId = requireEnv('RAZORPAY_KEY_ID');
  const keySecret = requireEnv('RAZORPAY_KEY_SECRET');
  // Lazy require so the stub driver doesn't need the package installed.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Razorpay = require('razorpay');
  cachedClient = new Razorpay({ key_id: keyId, key_secret: keySecret }) as RazorpayClient;
  return cachedClient;
}

export async function createOrder(args: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  if (args.amountPaise <= 0) throw new Error('amountPaise must be > 0');
  return getClient().orders.create({
    amount: args.amountPaise,
    currency: 'INR',
    receipt: args.receipt,
    notes: args.notes,
    payment_capture: 1,
  });
}

// Verify the signature returned by Razorpay Checkout to the client.
// Razorpay signs `${order_id}|${payment_id}` with the key secret.
export function verifyCheckoutSignature(args: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = requireEnv('RAZORPAY_KEY_SECRET');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${args.orderId}|${args.paymentId}`)
    .digest('hex');
  return timingSafeEqualHex(expected, args.signature);
}

// Verify the X-Razorpay-Signature header on a webhook delivery.
// The raw request body (string, before JSON parsing) must be passed in.
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = requireEnv('RAZORPAY_WEBHOOK_SECRET');
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeEqualHex(expected, signature);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ab.length !== bb.length || ab.length === 0) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function getPublicKeyId(): string {
  return requireEnv('RAZORPAY_KEY_ID');
}

// ─────────────────────────── Autopay / Mandate ───────────────────────────
//
// Razorpay Subscriptions = an SBI/HDFC/RBI-compliant e-mandate (NACH or UPI
// Autopay) tied to a Razorpay Plan. We create one Plan per (productId, planId)
// combination on first use, then attach a Subscription to it for the customer.
// Subsequent monthly charges are debited automatically; webhook delivers
// `subscription.charged` events which we treat the same as a successful
// one-shot recharge.

export async function createMandatePlan(args: {
  amountPaise: number;
  name: string;
  description?: string;
  interval?: number;
  period?: 'monthly' | 'yearly' | 'weekly' | 'daily';
}): Promise<RazorpayPlan> {
  if (args.amountPaise <= 0) throw new Error('amountPaise must be > 0');
  return getClient().plans.create({
    period: args.period ?? 'monthly',
    interval: args.interval ?? 1,
    item: {
      name: args.name,
      amount: args.amountPaise,
      currency: 'INR',
      description: args.description,
    },
  });
}

export async function createMandateSubscription(args: {
  planId: string;
  totalCount: number;
  notes?: Record<string, string>;
  startAt?: Date;
}): Promise<RazorpaySubscription> {
  return getClient().subscriptions.create({
    plan_id: args.planId,
    total_count: args.totalCount,
    customer_notify: 1,
    start_at: args.startAt ? Math.floor(args.startAt.getTime() / 1000) : undefined,
    notes: args.notes,
  });
}

export async function cancelMandate(subscriptionId: string, atCycleEnd = false): Promise<RazorpaySubscription> {
  return getClient().subscriptions.cancel(subscriptionId, { cancel_at_cycle_end: atCycleEnd ? 1 : 0 });
}

export async function pauseMandate(subscriptionId: string): Promise<RazorpaySubscription> {
  return getClient().subscriptions.pause(subscriptionId, { pause_at: 'now' });
}

export async function resumeMandate(subscriptionId: string): Promise<RazorpaySubscription> {
  return getClient().subscriptions.resume(subscriptionId, { resume_at: 'now' });
}
