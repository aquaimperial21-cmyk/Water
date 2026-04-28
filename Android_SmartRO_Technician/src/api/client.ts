import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

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

export const api = axios.create({ baseURL: apiBaseUrl, timeout: 15000 });

const ACCESS_KEY = 'smartro-tech.access';
const REFRESH_KEY = 'smartro-tech.refresh';
const USER_KEY = 'smartro-tech.user';

export async function setTokens(a: string, r: string) {
  await AsyncStorage.multiSet([[ACCESS_KEY, a], [REFRESH_KEY, r]]);
}
export async function clearTokens() {
  await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY, USER_KEY]);
}
export async function getAccess(): Promise<string | null> { return AsyncStorage.getItem(ACCESS_KEY); }
export async function getRefresh(): Promise<string | null> { return AsyncStorage.getItem(REFRESH_KEY); }
export async function setStoredUser(u: unknown) { await AsyncStorage.setItem(USER_KEY, JSON.stringify(u)); }
export async function getStoredUser<T>(): Promise<T | null> {
  const v = await AsyncStorage.getItem(USER_KEY);
  return v ? (JSON.parse(v) as T) : null;
}

api.interceptors.request.use(async (cfg) => {
  const t = await getAccess();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

let refreshing: Promise<string | null> | null = null;
async function tryRefresh(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const r = await getRefresh();
    if (!r) return null;
    try {
      const resp = await axios.post(`${apiBaseUrl}/auth/refresh`, { refreshToken: r });
      await setTokens(resp.data.data.accessToken, resp.data.data.refreshToken);
      return resp.data.data.accessToken as string;
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
      const t = await tryRefresh();
      if (t) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${t}`;
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
