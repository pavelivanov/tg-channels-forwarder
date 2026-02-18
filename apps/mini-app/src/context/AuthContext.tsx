import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { AuthResponse, AuthState, UserProfile } from '../types';
import { createApiClient } from '../lib/api-client';
import { getTelegramInitData, isTelegramEnvironment, telegramReady } from '../lib/telegram';

interface AuthContextValue extends AuthState {
  api: ReturnType<typeof createApiClient>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  const getToken = useCallback(() => tokenRef.current, []);
  const setToken = useCallback((t: string) => {
    tokenRef.current = t;
  }, []);
  const getInitData = useCallback(() => getTelegramInitData(), []);

  const apiRef = useRef(createApiClient(getToken, setToken, getInitData));

  useEffect(() => {
    if (!isTelegramEnvironment()) {
      setError('This app must be opened inside Telegram.');
      setIsLoading(false);
      return;
    }

    telegramReady();

    const initData = getTelegramInitData();
    if (!initData) {
      setError('Unable to read Telegram data.');
      setIsLoading(false);
      return;
    }

    fetch('/auth/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Authentication failed');
        }
        const data = (await res.json()) as AuthResponse;
        tokenRef.current = data.token;
        setUser(data.user);
      })
      .catch(() => {
        setError('Unable to connect. Please try again.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const value: AuthContextValue = {
    token: tokenRef.current,
    user,
    isAuthenticated: user !== null,
    isLoading,
    error,
    api: apiRef.current,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
