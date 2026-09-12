// Provider-agnostic messaging driver. The stub logs to console + persists to
// Notification table. Swap in a real driver (Gupshup / MSG91 / Twilio) by
// setting MESSAGING_DRIVER env and adding a sibling file that exports the
// same `MessagingDriver` shape.

import type { TemplateKey } from './templates';
import { stubDriver } from './stub';
import { msg91Driver } from './msg91';

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
  switch (which) {
    case 'msg91':
      cached = msg91Driver;
      break;
    case 'stub':
    default:
      cached = stubDriver;
      break;
  }
  // eslint-disable-next-line no-console
  console.log(`[messaging] driver = ${cached!.name}`);
  return cached!;
}

export type { TemplateKey };
