// Public website (Android_SmartRO_Website, hosted on Vercel) with the policy
// pages Razorpay and Google Play check. Same address in dev and release
// builds; it does not depend on which API the app talks to.

import { Linking } from 'react-native';
import { toast } from './messages';

export const SITE_URL = 'https://water-three-woad.vercel.app';

export const LEGAL_URLS = {
  terms: `${SITE_URL}/terms`,
  privacy: `${SITE_URL}/privacy`,
  refund: `${SITE_URL}/refund-policy`,
  delivery: `${SITE_URL}/shipping-policy`,
  contact: `${SITE_URL}/contact`,
  deleteAccount: `${SITE_URL}/delete-account`,
} as const;

/** Open a policy page in the browser; a failure must not crash a screen. */
export async function openLegal(page: keyof typeof LEGAL_URLS): Promise<void> {
  try {
    await Linking.openURL(LEGAL_URLS[page]);
  } catch {
    toast.error('Could not open the page', LEGAL_URLS[page]);
  }
}
