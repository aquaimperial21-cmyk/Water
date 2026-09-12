// Firebase phone sign-in.
//
// Firebase only proves the caller controls the number. The ID token it returns
// is then exchanged at POST /auth/firebase for SmartRO's own access + refresh
// pair, which is what every other API call uses.
//
// Requires a dev/preview build — this does NOT work in Expo Go.

import auth from '@react-native-firebase/auth';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

// The confirmation object cannot cross a navigation param (it is not
// serialisable), so it lives here between the phone screen and the code screen.
let pending: FirebaseAuthTypes.ConfirmationResult | null = null;

export async function sendPhoneCode(e164: string, resend = false): Promise<void> {
  pending = await auth().signInWithPhoneNumber(e164, resend);
}

export function hasPendingCode(): boolean {
  return pending !== null;
}

export function cancelPhoneCode(): void {
  pending = null;
}

/** Confirms the SMS code and returns a Firebase ID token to exchange with our API. */
export async function confirmPhoneCode(code: string): Promise<string> {
  if (!pending) throw new Error('auth/no-pending-code');

  await pending.confirm(code);
  const user = auth().currentUser;
  if (!user) throw new Error('auth/no-user');

  const idToken = await user.getIdToken();
  pending = null;

  // The Firebase session has done its job. SmartRO's own tokens take over from
  // here, so don't leave a second session lying around.
  await auth().signOut().catch(() => undefined);

  return idToken;
}

const MESSAGES: Record<string, string> = {
  'auth/invalid-phone-number': 'That number doesn’t look right. Check it and try again.',
  'auth/too-many-requests': 'Too many attempts from this device. Try again in a little while.',
  'auth/invalid-verification-code': 'That code is incorrect. Check it and try again.',
  'auth/code-expired': 'That code has expired. Tap resend to get a new one.',
  'auth/session-expired': 'That code has expired. Tap resend to get a new one.',
  'auth/quota-exceeded': 'SMS limit reached for today. Try again tomorrow or use your password.',
  'auth/network-request-failed': 'No connection. Check your network and try again.',
  'auth/missing-client-identifier': 'This build isn’t verified by Firebase. Add the SHA-256 fingerprint in the Firebase console and enable the Play Integrity API.',
  'auth/app-not-authorized': 'This app isn’t authorised for this Firebase project. Check the SHA-256 fingerprint and the API key restrictions.',
  'auth/billing-not-enabled': 'Firebase phone auth needs billing enabled on the project (Blaze plan).',
  'auth/internal-error': 'Firebase rejected the request. Usually a missing SHA-256 fingerprint or Play Integrity not enabled.',
  'auth/no-pending-code': 'That code request expired. Go back and request a new one.',
};

export function firebaseErrorMessage(e: unknown): string {
  const err = e as { code?: string; message?: string } | undefined;
  const code = err?.code ?? err?.message ?? '';
  const known = MESSAGES[code];
  if (known) return known;
  // Showing the raw code beats a generic apology — without it a failure here
  // is undiagnosable from a screenshot.
  return `Could not verify that number.

${code || 'unknown error'}`;
}
