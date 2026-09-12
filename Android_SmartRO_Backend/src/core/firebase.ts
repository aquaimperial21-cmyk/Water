// Firebase Admin — verifies the phone-auth ID tokens minted by the customer app
// and the admin console.
//
// Firebase only proves "this caller controls this phone number". SmartRO still
// owns identity: the User row, the role, and the access/refresh pair issued by
// core/auth.ts. Nothing about the existing authorization model changes.

import fs from 'node:fs';
import path from 'node:path';
import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Unauthorized } from './errors';

export interface FirebasePhoneIdentity {
  uid: string;
  phone: string; // E.164, e.g. +919876543210
}

function loadServiceAccount(): ServiceAccount {
  // Deployed: the whole key JSON pasted into one env var. Railway and Render
  // cannot mount a secret file, so this is the production path.
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    try {
      return JSON.parse(inline) as ServiceAccount;
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON');
    }
  }

  // Local dev: the key file downloaded from the Firebase console. Gitignored.
  const file = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? 'firebase-service-account.json';
  const resolved = path.resolve(process.cwd(), file);
  if (!fs.existsSync(resolved)) {
    throw new Error(
      `Firebase credentials missing. Set FIREBASE_SERVICE_ACCOUNT_JSON, or put the key at ${resolved}.`
    );
  }
  return JSON.parse(fs.readFileSync(resolved, 'utf8')) as ServiceAccount;
}

// Lazy: the app boots and serves /health even when Firebase is unconfigured.
// Only a login attempt surfaces the misconfiguration.
function ensureApp(): void {
  if (getApps().length > 0) return;
  initializeApp({ credential: cert(loadServiceAccount()) });
}

export async function verifyFirebasePhoneToken(idToken: string): Promise<FirebasePhoneIdentity> {
  ensureApp();

  let decoded;
  try {
    // checkRevoked: a token keeps working for up to an hour after sign-out
    // otherwise, which matters for a staff console.
    decoded = await getAuth().verifyIdToken(idToken, true);
  } catch {
    throw Unauthorized('Invalid or expired Firebase token');
  }

  if (!decoded.phone_number) {
    throw Unauthorized('Firebase token carries no verified phone number');
  }

  return { uid: decoded.uid, phone: decoded.phone_number };
}
