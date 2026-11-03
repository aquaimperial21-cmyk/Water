// Browser build of firebasePhone.ts. Metro picks this file for web automatically.
//
// @react-native-firebase is native-only, so the web preview signs in with the
// backend's own OTP endpoints instead. The backend returns the code in the
// response only when OTP_DEV_RETURN=true (local and test setups), and we
// pre-fill it on the code screen. With OTP_DEV_RETURN=false the code is sent
// by the backend's messaging driver and the user types it in.

import { apiErrorMessage, isNetworkError } from '../api/client';
import { Auth, type Session } from '../api/endpoints';

let devCode: string | null = null;

export async function sendPhoneCode(e164: string, _resend = false): Promise<void> {
  const res = await Auth.requestOtp(e164);
  devCode = res.devOtp ?? null;
}

/** The code the dev backend sent back, if any. Read-only so StrictMode's double render is safe. */
export function getDevCode(): string | null {
  return devCode;
}

export function hasPendingCode(): boolean {
  return true;
}

export function cancelPhoneCode(): void {
  devCode = null;
}

/** Checks the code with the backend and returns a SmartRO session. */
export async function exchangeCodeForSession(
  code: string,
  e164: string,
  fullName?: string,
  referralCode?: string
): Promise<Session> {
  return Auth.verifyOtp(e164, code, fullName, referralCode);
}

/** No background auto-verification in a browser. */
export function onAutoVerified(_e164: string, _cb: () => void): () => void {
  return () => undefined;
}

export async function finishPhoneSignIn(): Promise<void> {
  devCode = null;
}

export function firebaseErrorMessage(e: unknown): string {
  if (isNetworkError(e)) return 'Could not reach SmartRO. Is the backend running on port 4000?';
  return apiErrorMessage(e);
}
