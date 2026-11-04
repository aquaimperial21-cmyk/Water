// Provider-agnostic messaging driver. The stub logs to console + persists to
// Notification table. To send real SMS/WhatsApp later, add a sibling driver
// file that exports the same `MessagingDriver` shape and select it with the
// MESSAGING_DRIVER env. Only the stub exists today.

import type { TemplateKey } from './templates';
import { stubDriver } from './stub';

export type Channel = 'WHATSAPP' | 'SMS' | 'INAPP' | 'PUSH';

export interface SendOpts {
  to: string;            // E.164 phone number
  channel: Channel;
  templateKey: TemplateKey;
  vars: Record<string, string>;
}

export interface SendResult {
  providerMessageId: string;
}

export interface InboundMessage {
  from: string;          // E.164 phone of sender
  text: string;
  providerMessageId: string;
}

export interface MessagingDriver {
  name: string;
  send(opts: SendOpts): Promise<SendResult>;
  parseInboundWebhook(body: unknown): InboundMessage | null;
}

let cached: MessagingDriver | null = null;

export function getMessagingDriver(): MessagingDriver {
  if (cached) return cached;
  const which = process.env.MESSAGING_DRIVER ?? 'stub';
  if (which !== 'stub') {
    // eslint-disable-next-line no-console
    console.warn(`[messaging] MESSAGING_DRIVER="${which}" is not available; using the stub`);
  }
  cached = stubDriver;
  // eslint-disable-next-line no-console
  console.log(`[messaging] driver = ${cached!.name}`);
  return cached!;
}

export type { TemplateKey };
