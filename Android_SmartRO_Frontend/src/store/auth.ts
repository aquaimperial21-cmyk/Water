import { create } from 'zustand';
import { Auth } from '../api/endpoints';
import { clearTokens, getRefreshToken, getStoredUser, setStoredUser, setTokens } from '../api/client';

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
    const u = await getStoredUser<AuthUser>();
    set({ user: u, hydrated: true });
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
    set({ user: null });
  },
}));
