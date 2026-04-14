import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor: attach access token ────────────────────────────
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: auto-refresh on 401 ───────────────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: any) => void;
}> = [];

function processQueue(error: any, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token!);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Only attempt refresh on 401 errors for non-auth endpoints
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/register') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refresh_token');

        if (!refreshToken) {
          // No refresh token — force logout
          await AsyncStorage.multiRemove(['auth_token', 'refresh_token']);
          processQueue(error, null);
          // Notify the auth context via a custom event
          authEventEmitter.emit('force-logout');
          return Promise.reject(error);
        }

        // Call refresh endpoint
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        // Store new tokens
        await AsyncStorage.setItem('auth_token', data.access_token);
        await AsyncStorage.setItem('refresh_token', data.refresh_token);

        // Retry the original request with the new token
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        processQueue(null, data.access_token);

        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed — force full logout
        await AsyncStorage.multiRemove(['auth_token', 'refresh_token']);
        processQueue(refreshError, null);
        authEventEmitter.emit('force-logout');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ── Simple event emitter for auth state changes ─────────────────────────
// Used to notify AuthContext when tokens expire and refresh fails.
type AuthEventListener = () => void;

class AuthEventEmitter {
  private listeners: AuthEventListener[] = [];

  on(event: string, listener: AuthEventListener) {
    if (event === 'force-logout') {
      this.listeners.push(listener);
    }
  }

  off(event: string, listener: AuthEventListener) {
    if (event === 'force-logout') {
      this.listeners = this.listeners.filter((l) => l !== listener);
    }
  }

  emit(event: string) {
    if (event === 'force-logout') {
      this.listeners.forEach((l) => l());
    }
  }
}

export const authEventEmitter = new AuthEventEmitter();

export default api;
