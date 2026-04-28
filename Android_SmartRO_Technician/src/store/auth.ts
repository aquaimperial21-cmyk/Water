import { create } from 'zustand';
import { Auth } from '../api/endpoints';
import { clearTokens, getStoredUser, setStoredUser, setTokens } from '../api/client';

export interface AuthUser { id: string; email?: string | null; fullName?: string | null; kind: string; phone?: string }

interface State {
  user: AuthUser | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<State>((set) => ({
  user: null,
  hydrated: false,
  hydrate: async () => {
    const u = await getStoredUser<AuthUser>();
    set({ user: u, hydrated: true });
  },
  login: async (email, password) => {
    const data = await Auth.login(email, password);
    if (data.user.kind !== 'TECHNICIAN') {
      throw new Error('This account is not a technician account.');
    }
    await setTokens(data.accessToken, data.refreshToken);
    await setStoredUser(data.user);
    set({ user: data.user });
  },
  logout: async () => {
    await Auth.logout();
    await clearTokens();
    set({ user: null });
  },
}));
