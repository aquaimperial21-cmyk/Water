import type { MessagingDriver, InboundMessage } from './index';
import { renderTemplate } from './templates';

export const stubDriver: MessagingDriver = {
  name: 'stub',

  async send({ to, channel, templateKey, vars }) {
    const { title, body } = renderTemplate(templateKey, vars);
    const providerMessageId = `STUB_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // eslint-disable-next-line no-console
    console.log(
      `[messaging:${channel}] → ${to}\n  template: ${templateKey}\n  title: ${title}\n  body: ${body}\n  id: ${providerMessageId}`,
    );
    return { providerMessageId };
  },

  // Parses a generic inbound shape that real providers (Gupshup / Twilio /
  // MSG91) all loosely match. We accept either a single message envelope or
  // a webhook batch and return the first parseable item.
  parseInboundWebhook(body: unknown): InboundMessage | null {
    const b = body as Record<string, unknown>;
    if (!b) return null;

    const candidate =
      (b.message as Record<string, unknown> | undefined) ??
      ((b.messages as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined) ??
      b;

    const from = String(candidate.from ?? candidate.sender ?? candidate.wa_id ?? '');
    const text = String(
      candidate.text ??
        ((candidate.body as Record<string, unknown> | undefined)?.text ?? '') ??
        '',
    );
    const providerMessageId = String(
      candidate.id ?? candidate.messageId ?? candidate.providerMessageId ?? `INB_${Date.now()}`,
    );
    if (!from || !text) return null;
    return { from, text, providerMessageId };
  },
};
