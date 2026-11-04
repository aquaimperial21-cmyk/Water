import { create } from 'zustand';
import { Auth } from '../api/endpoints';
import { clearTokens, getRefreshToken, getStoredUser, setStoredUser, setTokens } from '../api/client';
import { clearLocalAccess } from '../utils/localPurifier';
import { reportAppError } from '../utils/crashReporter';

export interface AuthUser {
  id: string;
  phone: string;
  email?: string | null;
  fullName?: string | null;
  kind: string;
}

interface AuthState {
  user: AuthUser | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  signInWithFirebase: (idToken: string, fullName?: string, referralCode?: string) => Promise<void>;
  signInWithPassword: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  hydrate: async () => {
    try {
      const u = await getStoredUser<AuthUser>();
      set({ user: u, hydrated: true });
    } catch (e) {
      // The saved session can't be read: start signed out instead of spinning
      // forever, and drop it so the next launch starts clean.
      set({ user: null, hydrated: true });
      void reportAppError('promise', e);
      await clearTokens().catch(() => {});
    }
  },
  signInWithFirebase: async (idToken, fullName, referralCode) => {
    const data = await Auth.firebaseLogin(idToken, fullName, referralCode);
    await setTokens(data.accessToken, data.refreshToken);
    await setStoredUser(data.user);
    set({ user: data.user });
  },
  signInWithPassword: async (phone, password) => {
    const data = await Auth.passwordLogin(phone, password);
    await setTokens(data.accessToken, data.refreshToken);
    await setStoredUser(data.user);
    set({ user: data.user });
  },
  signOut: async () => {
    // Send the refresh token so the server revokes this device's session.
    // Without it the token stayed valid for its full 30 days.
    try { await Auth.logout((await getRefreshToken()) ?? undefined); } catch { /* ignore */ }
    await clearTokens();
    // The purifier's local key belongs to this account; don't leave it on a shared phone.
    await clearLocalAccess();
    set({ user: null });
  },
}));
