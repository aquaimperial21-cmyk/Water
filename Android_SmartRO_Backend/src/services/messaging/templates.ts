// WhatsApp / SMS template registry.
// Each template has a stable key and a body renderer. When a real provider is
// plugged in, the templates here become the source of truth for DLT/Meta
// approval; today the stub driver renders the same body to console + DB.

export type TemplateKey =
  | 'auth.otp'
  | 'recharge.reminder.7d'
  | 'recharge.reminder.3d'
  | 'recharge.reminder.1d'
  | 'recharge.success'
  | 'tech.schedule.daily'
  | 'tech.job.assigned'
  | 'banner.broadcast'
  | 'admin.broadcast.custom';

type Render = (vars: Record<string, string>) => { title: string; body: string };

const r = (vars: Record<string, string>, key: string, fallback = '') => vars[key] ?? fallback;

export const TEMPLATES: Record<TemplateKey, Render> = {
  'auth.otp': (v) => ({
    title: 'Verification code',
    body:
      `${r(v, 'otp')} is your SmartRO verification code. ` +
      `Valid for ${r(v, 'ttlMinutes', '5')} minutes. Do not share this code with anyone.`,
  }),
  'recharge.reminder.7d': (v) => ({
    title: 'Recharge in 7 days',
    body:
      `Hi ${r(v, 'name', 'there')}, your ${r(v, 'productName', 'ImperialAqua plan')} expires on ` +
      `${r(v, 'expiryDate')} (${r(v, 'daysLeft', '7')} days left). ` +
      `Recharge anytime to keep clean water flowing: ${r(v, 'rechargeLink', 'app://my-plan')}`,
  }),
  'recharge.reminder.3d': (v) => ({
    title: 'Recharge in 3 days',
    body:
      `Hi ${r(v, 'name', 'there')}, only 3 days left on your ${r(v, 'productName', 'plan')}. ` +
      `Renew now to avoid service interruption: ${r(v, 'rechargeLink', 'app://my-plan')}`,
  }),
  'recharge.reminder.1d': (v) => ({
    title: 'Recharge tomorrow',
    body:
      `Hi ${r(v, 'name', 'there')}, your ${r(v, 'productName', 'plan')} expires tomorrow. ` +
      `Renew now to keep your water purifier running: ${r(v, 'rechargeLink', 'app://my-plan')}`,
  }),
  'recharge.success': (v) => ({
    title: 'Plan renewed',
    body:
      `Thanks ${r(v, 'name', 'there')}! Your ${r(v, 'productName', 'plan')} is now active till ` +
      `${r(v, 'expiryDate')}. Cheers from ImperialAqua.`,
  }),
  'tech.schedule.daily': (v) => ({
    title: `Schedule for ${r(v, 'date', 'today')}`,
    body:
      `Hi ${r(v, 'name', 'team')}, your jobs for ${r(v, 'date', 'today')}:\n${r(v, 'jobs', 'No jobs today.')}` +
      `\nReply DONE <ticket-id> when complete, EN_ROUTE <ticket-id> when on the way.`,
  }),
  'tech.job.assigned': (v) => ({
    title: 'New job assigned',
    body:
      `Hi ${r(v, 'name')}, ticket ${r(v, 'ticketId')} (${r(v, 'category')}) at ${r(v, 'address', 'customer location')} ` +
      `scheduled ${r(v, 'when', 'today')}. ${r(v, 'confirmLink', '')}`,
  }),
  'banner.broadcast': (v) => ({
    title: r(v, 'title', 'Offer for you'),
    body: r(v, 'body', ''),
  }),
  'admin.broadcast.custom': (v) => ({
    title: r(v, 'title', 'ImperialAqua'),
    body: r(v, 'body', ''),
  }),
};

export function renderTemplate(key: TemplateKey, vars: Record<string, string>) {
  const fn = TEMPLATES[key];
  if (!fn) throw new Error(`Unknown template key: ${key}`);
  return fn(vars);
}
