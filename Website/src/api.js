// Calls to our own server. Every URL is relative (/api/v1/...): on Vercel a
// rewrite in vercel.json forwards it to the server, and `npm run dev` does the
// same through the proxy in vite.config.js, so the browser never makes a
// cross-origin request.
import { useSyncExternalStore } from 'react';

const API = '/api/v1';
const TIMEOUT_MS = 12000;

async function request(path, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: { Accept: 'application/json', ...options.headers },
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, json };
  } finally {
    clearTimeout(timer);
  }
}

// ---- Enquiry forms -------------------------------------------------------

// Sends one enquiry form to POST /api/v1/inquiries/website. Empty optional
// fields are left out; `website` (the honeypot) is always sent.
// Resolves to one of:
//   { ok: true }
//   { ok: false, kind: 'invalid', fields: { phone: 'msg', ... } }  (HTTP 400)
//   { ok: false, kind: 'rate', message }                          (HTTP 429)
//   { ok: false, kind: 'network' }                 (offline, timeout or 5xx)
export async function sendEnquiry(payload) {
  const body = {};
  for (const [key, value] of Object.entries(payload)) {
    const v = typeof value === 'string' ? value.trim() : value;
    if (key === 'website') body.website = value ?? '';
    else if (v !== '' && v != null) body[key] = v;
  }
  let res;
  try {
    res = await request('/inquiries/website', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, kind: 'network' };
  }
  if (res.ok && res.json?.data?.ok) return { ok: true };
  if (res.status === 400) return { ok: false, kind: 'invalid', fields: fieldErrors(res.json) };
  if (res.status === 429) {
    return {
      ok: false,
      kind: 'rate',
      message: res.json?.error?.message || 'Too many requests. Please try again in a little while.',
    };
  }
  return { ok: false, kind: 'network' };
}

// The server answers a 400 with { error: { fields: { name: ['msg'], ... } } }.
function fieldErrors(json) {
  const raw = json?.error?.fields;
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const msg = Array.isArray(value) ? value[0] : value;
    if (typeof msg === 'string' && msg) out[key] = msg;
  }
  return out;
}

const FIELD_HINTS = {
  name: 'Please check your name',
  phone: 'Please check this mobile number',
  email: 'Please check this email address',
  city: 'Please check your city',
  product: 'Please pick the model again',
};
const FIELD_LABELS = {
  name: 'name',
  phone: 'mobile number',
  email: 'email',
  city: 'city',
  product: 'model',
  heardFrom: 'how you heard about us',
  message: 'message',
};

export const SEND_FAILED = 'Couldn’t send. Please WhatsApp us.';

// Turns a failed sendEnquiry() result into the form's errors: a hint under
// each field the form can mark (`inline`), the rest in errors.submit.
// errors.offline is set when the WhatsApp button should be offered.
export function enquiryErrors(result, inline) {
  if (result.kind === 'rate') return { submit: result.message };
  if (result.kind !== 'invalid') return { submit: SEND_FAILED, offline: true };
  const errors = {};
  const others = [];
  for (const key of Object.keys(result.fields)) {
    if (inline.includes(key)) errors[key] = FIELD_HINTS[key] ?? 'Please check this';
    else if (FIELD_LABELS[key]) others.push(FIELD_LABELS[key]);
  }
  errors.submit = others.length
    ? `Please check your details: ${others.join(', ')}.`
    : 'Please check your details.';
  return errors;
}

// ---- Product catalog -----------------------------------------------------

// The live catalog is fetched once per page load and shared by every component
// that asks for it (Products, the contact form, the pop-up, Features).
// status: 'loading' until the answer arrives, then 'ready' or 'error'.
let catalog = { status: 'loading', products: [] };
let started = false;
const listeners = new Set();

function setCatalog(next) {
  catalog = next;
  listeners.forEach((fn) => fn());
}

function loadCatalog() {
  if (started) return;
  started = true;
  request('/products')
    .then((res) => {
      if (!res.ok || !Array.isArray(res.json?.data)) throw new Error(`products: HTTP ${res.status}`);
      const products = res.json.data.filter(
        (p) => p && p.isActive !== false && String(p.tag ?? '').toUpperCase() !== 'TEST',
      );
      if (products.length === 0) throw new Error('products: empty');
      setCatalog({ status: 'ready', products });
    })
    .catch(() => setCatalog({ status: 'error', products: [] }));
}

function subscribe(fn) {
  listeners.add(fn);
  loadCatalog();
  return () => listeners.delete(fn);
}

const getCatalog = () => catalog;

export function useCatalog() {
  return useSyncExternalStore(subscribe, getCatalog, getCatalog);
}

// Price rows whose plan is still on sale.
export const activePrices = (product) =>
  (product?.prices ?? []).filter((pr) => pr?.plan && pr.plan.isActive !== false && pr.monthlyPricePaise > 0);

// The lowest monthly rent across every live product, city and plan (paise), or
// null while the catalog is loading or unavailable.
export function lowestMonthlyPaise(state) {
  if (state.status !== 'ready') return null;
  let min = null;
  for (const p of state.products) {
    for (const pr of activePrices(p)) {
      if (min === null || pr.monthlyPricePaise < min) min = pr.monthlyPricePaise;
    }
  }
  return min;
}

// Plan lengths on sale (months, ascending), e.g. [1, 3, 6, 12].
export function planTerms(state) {
  if (state.status !== 'ready') return [];
  const terms = new Set();
  for (const p of state.products) for (const pr of activePrices(p)) terms.add(pr.plan.durationMonths);
  return [...terms].filter((n) => n > 0).sort((a, b) => a - b);
}

// 59900 -> "₹599", 169900 -> "₹1,699", 59950 -> "₹599.50".
export function formatRupees(paise) {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
