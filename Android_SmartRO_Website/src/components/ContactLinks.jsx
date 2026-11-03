import { EMAIL, PHONE, PHONE_DISPLAY, whatsappLink } from '../siteInfo';

export function PhoneLink() {
  return <a href={`tel:${PHONE}`}>{PHONE_DISPLAY}</a>;
}

export function EmailLink({ subject }) {
  const href = subject ? `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}` : `mailto:${EMAIL}`;
  return <a href={href}>{EMAIL}</a>;
}

export function WhatsAppLink({ text, children = 'WhatsApp' }) {
  return (
    <a href={whatsappLink(text)} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
