import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// On Android emulator, localhost on the host machine is reachable as 10.0.2.2
// On iOS simulator + web, localhost works.
// For physical devices, set EXPO_PUBLIC_API_URL or edit app.json -> extra.apiBaseUrl to your LAN IP.
function resolveBaseUrl(): string {
  const fromEnv = (process.env as Record<string, string | undefined>).EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;
  const fromExtra = (Constants?.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl;
  if (Platform.OS === 'android') {
    return (fromExtra ?? 'http://localhost:4000/api/v1').replace('localhost', '10.0.2.2');
  }
  return fromExtra ?? 'http://localhost:4000/api/v1';
}

export const apiBaseUrl = resolveBaseUrl();

// Origin (no /api/v1) — used to resolve relative /uploads/... paths returned
// by the admin upload endpoint into absolute URLs the RN <Image> can fetch.
export const assetBaseUrl = apiBaseUrl.replace(/\/api\/v1\/?$/, '');

/** Resolve a relative /uploads/... path to an absolute URL. */
export function assetUrl(u?: string | null): string | null {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return `${assetBaseUrl}${u.startsWith('/') ? u : `/${u}`}`;
}

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
});

const ACCESS_KEY = 'smartro.access';
const REFRESH_KEY = 'smartro.refresh';
const USER_KEY = 'smartro.user';

export async function setTokens(access: string, refresh: string) {
  await AsyncStorage.multiSet([[ACCESS_KEY, access], [REFRESH_KEY, refresh]]);
}
export async function clearTokens() {
  await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY, USER_KEY]);
}
export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS_KEY);
}
export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_KEY);
}
export async function setStoredUser(user: unknown) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}
export async function getStoredUser<T>(): Promise<T | null> {
  const v = await AsyncStorage.getItem(USER_KEY);
  return v ? (JSON.parse(v) as T) : null;
}

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;
async function tryRefresh(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const refresh = await getRefreshToken();
    if (!refresh) return null;
    try {
      const r = await axios.post(`${apiBaseUrl}/auth/refresh`, { refreshToken: refresh });
      const { accessToken, refreshToken } = r.data.data;
      await setTokens(accessToken, refreshToken);
      return accessToken as string;
    } catch {
      await clearTokens();
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const original = err.config as (typeof err.config & { _retry?: boolean }) | undefined;
    if (err.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const newAccess = await tryRefresh();
      if (newAccess) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api.request(original);
      }
    }
    return Promise.reject(err);
  }
);

export function apiErrorMessage(e: unknown): string {
  const ax = e as AxiosError<{ error?: { message?: string } }>;
  return ax?.response?.data?.error?.message ?? (e as Error)?.message ?? 'Something went wrong';
}
