import type { ApiError, AuthResponse } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || '';

interface ApiClient {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  patch: <T>(path: string, body?: unknown) => Promise<T>;
  del: (path: string) => Promise<void>;
}

export function createApiClient(
  getToken: () => string | null,
  setToken: (token: string) => void,
  getInitData: () => string | undefined,
): ApiClient {
  async function refreshToken(): Promise<string | null> {
    const initData = getInitData();
    if (!initData) return null;

    const res = await fetch(`${BASE_URL}/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as AuthResponse;
    setToken(data.token);
    return data.token;
  }

  async function request<T>(
    path: string,
    options: RequestInit,
    isRetry = false,
  ): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401 && !isRetry) {
      const newToken = await refreshToken();
      if (newToken) {
        return request<T>(path, options, true);
      }
    }

    if (!res.ok) {
      const error = (await res.json().catch(() => ({
        statusCode: res.status,
        message: res.statusText,
        error: 'Request Failed',
      }))) as ApiError;
      throw error;
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return res.json() as Promise<T>;
  }

  return {
    get: <T>(path: string) => request<T>(path, { method: 'GET' }),
    post: <T>(path: string, body?: unknown) =>
      request<T>(path, {
        method: 'POST',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
    patch: <T>(path: string, body?: unknown) =>
      request<T>(path, {
        method: 'PATCH',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
    del: (path: string) =>
      request<void>(path, { method: 'DELETE' }),
  };
}
