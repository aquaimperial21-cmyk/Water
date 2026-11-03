import { api } from './client';

export interface City { id: string; name: string; state: string; isServiceable: boolean; }
export interface Plan { id: string; name: string; durationMonths: number; isActive?: boolean; }
export interface PlanCityPrice {
  id: string; planId: string; cityId: string; productId: string;
  monthlyPricePaise: number; depositPaise: number; plan?: Plan;
}
export interface Product {
  id: string; slug: string; name: string; kind: 'HOME' | 'COMMERCIAL';
  capacityLitres: number; technology: string; mounting: string;
  description: string; imageUrl?: string; warrantyMonths: number;
  personasMin?: number | null;
  personasMax?: number | null;
  tag?: string | null;
  lowestMonthlyPaise?: number | null;
  prices?: PlanCityPrice[];
}
export interface Booking {
  id: string; userId: string; productId: string; planId: string; cityId: string;
  depositPaise: number; firstPaymentPaise: number; status: string;
  installationSlot?: string; agreementSignedAt?: string; createdAt: string;
  trialEndsAt?: string | null;
  cancelledAt?: string | null;
  referralCode?: string | null;
  referralCreditPaise?: number;
  product?: Product; plan?: Plan; city?: City;
  jobs?: { id: string; type: string; scheduledFor: string; status: string; technician?: { id: string; user?: { fullName?: string | null; phone?: string | null } } }[];
}
/**
 * The server sends only these. "Expired" is not a status: it is ACTIVE with
 * expiresAt <= now (see utils/planState.ts).
 */
export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CLOSED';
/**
 * CREATED: authorisation not finished · PENDING: a debit failed, Razorpay is
 * retrying · HALTED: Razorpay gave up · CANCEL_FAILED: we couldn't stop the
 * mandate (support must) · COMPLETED: the mandate ran out.
 */
export type AutopayStatus =
  | 'CREATED' | 'ACTIVE' | 'PAUSED' | 'PENDING' | 'HALTED' | 'CANCELLED' | 'CANCEL_FAILED' | 'COMPLETED';
export interface SubscriptionRefund { amountPaise: number; status: 'INITIATED' | 'SUCCESS'; createdAt: string; }
export interface SubscriptionVisit { scheduledFor: string; type: string; } // type: INSTALL | SERVICE | FILTER | PICKUP
export interface Subscription {
  id: string; userId: string; productId: string; planId: string;
  status: SubscriptionStatus;
  startedAt: string; expiresAt: string;
  /** End of the first term; cancel is refused between trial end and this. */
  lockInUntil: string;
  /** startedAt + 7 days; a cancel before it refunds deposit + first payment. */
  trialEndsAt?: string | null;
  /** Set while PAUSED; on resume the paused time is added back to expiresAt. */
  pausedAt?: string | null;
  cancelledAt?: string | null;
  autopayId?: string | null;
  autopayStatus?: AutopayStatus | null;
  product?: Product; plan?: Plan;
  /** Paired at installation; null before it. */
  device?: { serial: string; lastHeartbeatAt?: string | null; firmwareVersion?: string | null } | null;
  booking?: Booking;
  refund?: SubscriptionRefund | null;
  nextVisit?: SubscriptionVisit | null;
}
export type AutopayCreateResult =
  | { alreadyActive: true; autopayId?: string | null }
  | {
      alreadyActive?: false;
      keyId: string;
      autopayId: string;
      shortUrl?: string | null;
      amountPaise: number;
      period: 'monthly' | 'yearly';
      /** First debit on the renewal date; null = immediately after authorising. */
      firstDebitAt?: string | null;
    };
export interface DeviceHealth {
  serial: string;
  isOnline: boolean;
  lastHeartbeatAt?: string | null;
  tdsPpm?: number | null;
  filterLifePct?: number | null;
  usageLitresTotal: number;
  leakDetectedAt?: string | null;
  subscriptionStatus: string;
  expiresAt: string;
  planName: string;
}
/** GET /devices/me/local-access — what the app needs to switch the purifier over home Wi-Fi. */
export interface LocalAccess {
  serial: string;
  /** IPv4 the purifier reported in its last heartbeat. */
  localIp: string | null;
  /** 64-char hex key for signing on/off commands; null if the device has no token yet. */
  localKey: string | null;
  lastHeartbeatAt: string | null;
  isOnline: boolean;
}
export interface DeviceReading {
  id: string; kind: string;
  tdsPpm?: number | null; usageLitres?: number | null; filterLifePct?: number | null;
  createdAt: string;
}
export interface InstallSlot { start: string; end: string; label: string; }
export interface ReferralInfo {
  referralCode: string | null;
  referredByCode: string | null;
  referralRewardPaise: number;
  referrals: number;
  rewardPaiseAvailable: number;
  rewardPaisePerReferral: number;
}
export interface Invoice {
  id: string; number: string; amountPaise: number; gstPaise: number; createdAt: string;
  payment?: { id: string; kind: string; amountPaise: number; createdAt: string; updatedAt: string; gatewayRef?: string | null };
}
export interface Ticket {
  id: string; category: string; description: string; status: string;
  priority: string; slaDueAt?: string; createdAt: string; rating?: number;
}
export interface Banner {
  id: string;
  title: string;
  body?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaTarget?: string | null;
  audience: string;
  startsAt: string;
  endsAt: string;
  priority: number;
}
export interface Notification {
  id: string;
  channel: string;
  title: string;
  body: string;
  templateKey?: string | null;
  status: string;
  readAt?: string | null;
  createdAt: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; phone: string; email?: string; fullName?: string; kind: string };
}

export const Auth = {
  requestOtp: (phone: string) => api.post('/auth/otp/request', { phone }).then((r) => r.data.data as { sent: boolean; devOtp?: string }),
  verifyOtp: (phone: string, otp: string, fullName?: string, referralCode?: string) =>
    api.post('/auth/otp/verify', { phone, otp, fullName, referralCode })
      .then((r) => r.data.data as Session),
  // Exchanges a Firebase phone-auth ID token for a SmartRO session.
  firebaseLogin: (idToken: string, fullName?: string, referralCode?: string) =>
    api.post('/auth/firebase', { idToken, fullName, referralCode })
      .then((r) => r.data.data as Session),
  passwordLogin: (phone: string, password: string) =>
    api.post('/auth/password/login', { phone, password })
      .then((r) => r.data.data as Session),
  setPassword: (password: string, currentPassword?: string) =>
    api.post('/auth/password/set', { password, currentPassword })
      .then((r) => r.data.data as { ok: boolean; hasPassword: boolean }),
  me: () => api.get('/auth/me').then((r) => r.data.data),
  logout: (refreshToken?: string) => api.post('/auth/logout', { refreshToken }),
  // Erases the account. 409 ACCOUNT_HAS_ACTIVE_PLAN / ACCOUNT_REFUND_PENDING
  // carry a message meant for the customer.
  deleteAccount: () =>
    api.post('/auth/account/delete', { confirm: 'DELETE' }).then((r) => r.data.data as { deleted: true }),
};

export const Catalog = {
  cities: (includeAll = false) =>
    api.get('/cities', { params: includeAll ? { includeAll: 'true' } : {} }).then((r) => r.data.data as City[]),
  products: (cityId?: string, kind?: 'HOME' | 'COMMERCIAL') =>
    api.get('/products', { params: { cityId, kind } }).then((r) => r.data.data as Product[]),
  product: (slug: string) => api.get(`/products/${slug}`).then((r) => r.data.data as Product),
  plans: () => api.get('/plans').then((r) => r.data.data as Plan[]),
  pricing: (productId: string, cityId: string) =>
    api.get('/pricing', { params: { productId, cityId } }).then((r) => r.data.data as PlanCityPrice[]),
};

export const Bookings = {
  create: (input: { productId: string; planId: string; cityId: string }) =>
    api.post('/bookings', input).then((r) => r.data.data as Booking),
  mine: () => api.get('/bookings/me').then((r) => r.data.data as Booking[]),
  get: (id: string) => api.get(`/bookings/${id}`).then((r) => r.data.data as Booking),
  signAgreement: (id: string) => api.post(`/bookings/${id}/sign-agreement`).then((r) => r.data.data as Booking),
  pay: (id: string) => api.post(`/bookings/${id}/pay`).then((r) => r.data.data),
  installSlots: (id: string) => api.get(`/bookings/${id}/install-slots`).then((r) => r.data.data as InstallSlot[]),
  setInstallSlot: (id: string, start: string) =>
    api.post(`/bookings/${id}/install-slot`, { start }).then((r) => r.data.data as { booking: Booking; job: { id: string; scheduledFor: string }; technicianId: string }),
  agreementUrl: (id: string) => `/bookings/${id}/agreement.pdf`, // relative; consumer prefixes apiBaseUrl
};

export const Kyc = {
  submit: (input: { aadhaarLast4: string; pan: string; selfieUrl?: string }) =>
    api.post('/kyc', input).then((r) => r.data.data),
  mine: () => api.get('/kyc/me').then((r) => r.data.data),
};

export const Subscriptions = {
  mine: () => api.get('/subscriptions/me').then((r) => r.data.data as Subscription[]),
  recharge: (id: string, planId?: string) =>
    api.post(`/subscriptions/${id}/recharge`, { planId }).then((r) => r.data.data as Subscription),
  pause: (id: string, reason?: string) =>
    api.post(`/subscriptions/${id}/pause`, { reason }).then((r) => r.data.data as Subscription),
  resume: (id: string) =>
    api.post(`/subscriptions/${id}/resume`).then((r) => r.data.data as Subscription),
  cancel: (id: string, reason?: string) =>
    api.post(`/subscriptions/${id}/cancel`, { reason })
      .then((r) => r.data.data as { subscription: Subscription; refundPaise: number }),
  cancelBooking: (bookingId: string, reason?: string) =>
    api.post(`/subscriptions/booking/${bookingId}/cancel`, { reason }).then((r) => r.data.data as Booking),
};

export const Payments = {
  // Which gateway the server runs: 'razorpay' → Checkout flow below; 'stub' → Bookings.pay / Subscriptions.recharge.
  config: () =>
    api.get('/payments/config').then((r) => r.data.data as { driver: 'stub' | 'razorpay'; keyId: string | null }),
  createBookingOrder: (bookingId: string) =>
    api.post(`/payments/bookings/${bookingId}/order`).then((r) => r.data.data as { keyId: string; orderId: string; amount: number; currency: string; paymentId: string }),
  createRechargeOrder: (subscriptionId: string, planId?: string) =>
    api.post(`/payments/subscriptions/${subscriptionId}/order`, { planId }).then((r) => r.data.data as { keyId: string; orderId: string; amount: number; currency: string; paymentId: string; planId: string }),
  verify: (input: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    api.post('/payments/verify', input).then((r) => r.data.data),
  // Asks Razorpay for this order's payments and settles a captured one: for when
  // Checkout's answer never reached /verify or can't be trusted. settled → our row is SUCCESS.
  sync: (orderId: string) =>
    api.post(`/payments/orders/${orderId}/sync`).then((r) => r.data.data as { status: 'SUCCESS' | 'INITIATED' | 'FAILED'; settled: boolean }),
  autopay: {
    // ACTIVE → { alreadyActive: true }; CREATED → the stale mandate is replaced.
    // Refused for PAUSED/CLOSED plans, and 409 RAZORPAY_DISABLED on the stub gateway.
    create: (subscriptionId: string) =>
      api.post(`/payments/subscriptions/${subscriptionId}/autopay`).then((r) => r.data.data as AutopayCreateResult),
    cancel: (subscriptionId: string, atCycleEnd = false) =>
      api.post(`/payments/subscriptions/${subscriptionId}/autopay/cancel`, { atCycleEnd }).then((r) => r.data.data),
    pause: (subscriptionId: string) =>
      api.post(`/payments/subscriptions/${subscriptionId}/autopay/pause`).then((r) => r.data.data),
    resume: (subscriptionId: string) =>
      api.post(`/payments/subscriptions/${subscriptionId}/autopay/resume`).then((r) => r.data.data),
  },
};

export const Referrals = {
  me: () => api.get('/referrals/me').then((r) => r.data.data as ReferralInfo),
  apply: (code: string) => api.post('/referrals/apply', { code }).then((r) => r.data.data),
};

export const DeviceHealthApi = {
  me: () => api.get('/devices/me/health').then((r) => r.data.data as DeviceHealth | null),
  readings: (kind?: string, limit = 50) =>
    api.get('/devices/me/readings', { params: { kind, limit } }).then((r) => r.data.data as DeviceReading[]),
  /** null when no purifier is paired with the customer yet. */
  localAccess: () => api.get('/devices/me/local-access').then((r) => r.data.data as LocalAccess | null),
  registerPushToken: (token: string, platform: 'EXPO' | 'FCM' | 'APNS' = 'EXPO', deviceLabel?: string) =>
    api.post('/devices/me/push-token', { token, platform, deviceLabel }).then((r) => r.data.data),
};

export const Support = {
  waitlist: (input: { phone: string; cityName: string; pincode?: string; productId?: string }) =>
    api.post('/waitlist', input).then((r) => r.data.data),
  createHelpRequest: (input: { channel: 'CALL' | 'WHATSAPP' | 'CHAT' | 'FAQ'; topic?: string; message?: string }) =>
    api.post('/help-requests', input).then((r) => r.data.data),
  myHelpRequests: () => api.get('/help-requests/me').then((r) => r.data.data),
};

export const Invoices = {
  mine: () => api.get('/invoices/me').then((r) => r.data.data as Invoice[]),
  pdfUrl: (id: string) => `/invoices/${id}.pdf`, // relative path; consumer prefixes apiBaseUrl
};

export const Tickets = {
  create: (input: { subscriptionId?: string; category: string; description: string; priority?: string }) =>
    api.post('/tickets', input).then((r) => r.data.data as Ticket),
  mine: () => api.get('/tickets/me').then((r) => r.data.data as Ticket[]),
  get: (id: string) => api.get(`/tickets/${id}`).then((r) => r.data.data),
  rate: (id: string, rating: number, comment?: string) =>
    api.post(`/tickets/${id}/rate`, { rating, comment }).then((r) => r.data.data),
};

export const Inquiries = {
  create: (input: { name: string; phone: string; pincode: string; cityId?: string; productId?: string; planId?: string; notes?: string }) =>
    api.post('/inquiries', input).then((r) => r.data.data),
};

export const Banners = {
  list: () => api.get('/banners').then((r) => r.data.data as Banner[]),
};

export const Notifications = {
  mine: () =>
    api.get('/notifications/me').then((r) => r.data.data as { items: Notification[]; unreadCount: number }),
  read: (id: string) => api.post(`/notifications/${id}/read`).then((r) => r.data.data as Notification),
  readAll: () => api.post('/notifications/read-all').then((r) => r.data.data as { updated: number }),
};

export const Devices = {
  // ESP32 endpoints — used by hardware, not by the customer app, but kept here
  // for reference + smoke-testability from a tsx repl.
  state: (serial: string, token: string) =>
    api.get(`/devices/${serial}/state`, { params: { token } }).then((r) => r.data.data as {
      allowFlow: boolean;
      status: string;
      expiresAt: string | null;
      graceDays: number;
      message: string | null;
      serverTime: string;
    }),
};
