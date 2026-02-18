import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

function mockSdk(initData = 'mock-init-data-string') {
  vi.doMock('@twa-dev/sdk', () => ({
    default: {
      initData,
      ready: vi.fn(),
      expand: vi.fn(),
      close: vi.fn(),
      BackButton: { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() },
      MainButton: { show: vi.fn(), hide: vi.fn(), setText: vi.fn(), onClick: vi.fn(), offClick: vi.fn() },
      showConfirm: vi.fn(),
    },
  }));
}

describe('AuthProvider', () => {
  const mockUser = {
    id: '1',
    telegramId: '123456789',
    firstName: 'Test',
    lastName: 'User',
    username: 'testuser',
    photoUrl: null,
    isPremium: false,
  };

  beforeEach(() => {
    vi.resetModules();
    mockSdk();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ token: 'jwt-token', user: mockUser }),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function renderAuth() {
    const { AuthProvider, useAuth } = await import('../src/context/AuthContext');

    function wrapper({ children }: { children: ReactNode }) {
      return <AuthProvider>{children}</AuthProvider>;
    }

    return renderHook(() => useAuth(), { wrapper });
  }

  it('stores token and user after successful auth', async () => {
    const { result } = await renderAuth();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.error).toBeNull();
  });

  it('shows loading state during auth', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  json: () =>
                    Promise.resolve({ token: 'jwt-token', user: mockUser }),
                }),
              100,
            ),
          ),
      ),
    );

    const { result } = await renderAuth();

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('shows error when backend unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );

    const { result } = await renderAuth();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBe('Unable to connect. Please try again.');
  });

  it('shows error when initData is empty (outside Telegram)', async () => {
    vi.resetModules();
    mockSdk('');

    const { AuthProvider, useAuth } = await import('../src/context/AuthContext');

    function wrapper({ children }: { children: ReactNode }) {
      return <AuthProvider>{children}</AuthProvider>;
    }

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBe(
      'This app must be opened inside Telegram.',
    );
  });

  it('shows error on 401 auth response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }),
    );

    const { result } = await renderAuth();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBe('Unable to connect. Please try again.');
  });
});
