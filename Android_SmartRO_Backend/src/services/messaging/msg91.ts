// MSG91 driver — sends SMS via the Flow API (https://docs.msg91.com/p/tf9GTextN/e/Q3W_RhMjbT/MSG91).
//
// Each DLT-approved template lives under its own MSG91 template_id. We map our
// internal TemplateKey → MSG91 template_id through env vars so adding new
// templates does not require code changes.
//
// Required env:
//   MSG91_AUTH_KEY          MSG91 account auth key
//   MSG91_TEMPLATE_AUTH_OTP MSG91 template_id for the OTP template
// Optional env:
//   MSG91_TEMPLATE_<KEY>    template_id for any other TemplateKey (uppercase, dots → underscores)
//   MSG91_SENDER_ID         DLT-registered sender ID (only needed if your MSG91 template requires it)

import type { MessagingDriver, SendOpts, SendResult, InboundMessage } from './index';
import type { TemplateKey } from './templates';
import { renderTemplate } from './templates';

const FLOW_ENDPOINT = 'https://control.msg91.com/api/v5/flow';

function envKeyFor(templateKey: TemplateKey): string {
  return `MSG91_TEMPLATE_${templateKey.toUpperCase().replace(/[.\-]/g, '_')}`;
}

function templateIdFor(templateKey: TemplateKey): string {
  const id = process.env[envKeyFor(templateKey)];
  if (!id) {
    throw new Error(
      `MSG91 template_id missing for "${templateKey}". Set ${envKeyFor(templateKey)} in env.`,
    );
  }
  return id;
}

function normalizeMobile(to: string): string {
  // MSG91 expects digits only (e.g. "919876543210"), not "+919876543210"
  const digits = to.replace(/\D+/g, '');
  if (digits.length < 10 || digits.length > 15) {
    throw new Error(`Invalid mobile for MSG91: ${to}`);
  }
  return digits;
}

// MSG91 Flow API replaces the template variables by position (var1, var2, ...).
// We stringify all values and emit them in insertion order so the caller controls
// the order via the `vars` object literal. This matches how the rest of the
// codebase already passes template variables.
function buildRecipient(to: string, vars: Record<string, string>): Record<string, string> {
  const r: Record<string, string> = { mobiles: normalizeMobile(to) };
  Object.entries(vars).forEach(([k, v]) => {
    r[k] = String(v);
  });
  return r;
}

export const msg91Driver: MessagingDriver = {
  name: 'msg91',

  async send(opts: SendOpts): Promise<SendResult> {
    const authKey = process.env.MSG91_AUTH_KEY;
    if (!authKey) throw new Error('MSG91_AUTH_KEY is not set');

    const template_id = templateIdFor(opts.templateKey);
    const recipient = buildRecipient(opts.to, opts.vars);

    const payload: Record<string, unknown> = {
      template_id,
      short_url: '0',
      recipients: [recipient],
    };
    if (process.env.MSG91_SENDER_ID) {
      payload.sender = process.env.MSG91_SENDER_ID;
    }

    const res = await fetch(FLOW_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        authkey: authKey,
      },
      body: JSON.stringify(payload),
    });

    const json = (await res.json().catch(() => ({}))) as {
      type?: string;
      message?: string;
      request_id?: string;
    };

    if (!res.ok || json.type === 'error') {
      const { body: rendered } = renderTemplate(opts.templateKey, opts.vars);
      // eslint-disable-next-line no-console
      console.error(
        `[messaging:msg91] send FAILED to=${opts.to} template=${opts.templateKey} status=${res.status} resp=${JSON.stringify(json)} rendered="${rendered}"`,
      );
      throw new Error(`MSG91 send failed: ${json.message ?? `HTTP ${res.status}`}`);
    }

    const providerMessageId = json.request_id ?? json.message ?? `MSG91_${Date.now()}`;
    // eslint-disable-next-line no-console
    console.log(
      `[messaging:msg91] sent to=${opts.to} template=${opts.templateKey} id=${providerMessageId}`,
    );
    return { providerMessageId };
  },

  // MSG91 inbound SMS webhook payload shape (subset). Two-way SMS is opt-in on
  // MSG91; this parser accepts the documented field names so the same webhook
  // route can serve any driver.
  parseInboundWebhook(body: unknown): InboundMessage | null {
    const b = body as Record<string, unknown> | null;
    if (!b) return null;
    const from = String(b.mobile ?? b.from ?? '');
    const text = String(b.message ?? b.text ?? '');
    const providerMessageId = String(b.requestId ?? b.id ?? `MSG91_INB_${Date.now()}`);
    if (!from || !text) return null;
    return { from, text, providerMessageId };
  },
};
