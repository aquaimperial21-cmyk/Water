import { create } from 'zustand';
import { Auth } from '../api/endpoints';
import { clearTokens, getStoredUser, setStoredUser, setTokens } from '../api/client';

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
  signIn: (phone: string, otp: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  hydrate: async () => {
    const u = await getStoredUser<AuthUser>();
    set({ user: u, hydrated: true });
  },
  signIn: async (phone, otp, fullName) => {
    const data = await Auth.verifyOtp(phone, otp, fullName);
    await setTokens(data.accessToken, data.refreshToken);
    await setStoredUser(data.user);
    set({ user: data.user });
  },
  signOut: async () => {
    try { await Auth.logout(); } catch { /* ignore */ }
    await clearTokens();
    set({ user: null });
  },
}));
