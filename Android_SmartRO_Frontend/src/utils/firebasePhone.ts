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
  'auth/missing-client-identifier': 'This build isn’t registered with Firebase yet. Add the app’s SHA-1 fingerprint in the Firebase console.',
  'auth/no-pending-code': 'That code request expired. Go back and request a new one.',
};

export function firebaseErrorMessage(e: unknown): string {
  const code = (e as { code?: string; message?: string })?.code
    ?? (e as { message?: string })?.message
    ?? '';
  return MESSAGES[code] ?? 'Could not verify that number. Please try again.';
}
