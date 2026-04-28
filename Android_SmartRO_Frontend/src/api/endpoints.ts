import { api } from './client';

export interface City { id: string; name: string; state: string; isServiceable: boolean; }
export interface Plan { id: string; name: string; durationDays: number; }
export interface PlanCityPrice {
  id: string; planId: string; cityId: string; productId: string;
  monthlyPricePaise: number; depositPaise: number; plan?: Plan;
}
export interface Product {
  id: string; slug: string; name: string; kind: 'HOME' | 'COMMERCIAL';
  capacityLitres: number; technology: string; mounting: string;
  description: string; imageUrl?: string; warrantyMonths: number;
  prices?: PlanCityPrice[];
}
export interface Booking {
  id: string; userId: string; productId: string; planId: string; cityId: string;
  depositPaise: number; firstPaymentPaise: number; status: string;
  installationSlot?: string; agreementSignedAt?: string; createdAt: string;
  product?: Product; plan?: Plan; city?: City;
}
export interface Subscription {
  id: string; userId: string; productId: string; planId: string;
  status: 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'CLOSED';
  startedAt: string; expiresAt: string; lockInUntil: string;
  product?: Product; plan?: Plan; device?: { serial: string };
  booking?: Booking;
}
export interface Ticket {
  id: string; category: string; description: string; status: string;
  priority: string; slaDueAt?: string; createdAt: string; rating?: number;
}

export const Auth = {
  requestOtp: (phone: string) => api.post('/auth/otp/request', { phone }).then((r) => r.data.data as { sent: boolean; devOtp?: string }),
  verifyOtp: (phone: string, otp: string, fullName?: string) =>
    api.post('/auth/otp/verify', { phone, otp, fullName }).then((r) => r.data.data as { accessToken: string; refreshToken: string; user: { id: string; phone: string; email?: string; fullName?: string; kind: string } }),
  me: () => api.get('/auth/me').then((r) => r.data.data),
  logout: (refreshToken?: string) => api.post('/auth/logout', { refreshToken }),
};

export const Catalog = {
  cities: () => api.get('/cities').then((r) => r.data.data as City[]),
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
