import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApiClient } from '../src/lib/api-client';

describe('api-client', () => {
  const mockFetch = vi.fn();
  let getToken: ReturnType<typeof vi.fn>;
  let setToken: ReturnType<typeof vi.fn>;
  let getInitData: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    getToken = vi.fn().mockReturnValue('test-token');
    setToken = vi.fn();
    getInitData = vi.fn().mockReturnValue('mock-init-data');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches Authorization header to requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
    });

    const client = createApiClient(getToken, setToken, getInitData);
    await client.get('/channels');

    expect(mockFetch).toHaveBeenCalledWith(
      '/channels',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('re-authenticates on 401 and retries the original request', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ token: 'new-token', user: {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ id: '1' }]),
      });

    const client = createApiClient(getToken, setToken, getInitData);
    const result = await client.get('/channels');

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      '/auth/validate',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(setToken).toHaveBeenCalledWith('new-token');
    expect(result).toEqual([{ id: '1' }]);
  });

  it('does not retry more than once on repeated 401', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ token: 'new-token', user: {} }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            statusCode: 401,
            message: 'Unauthorized',
            error: 'Unauthorized',
          }),
      });

    const client = createApiClient(getToken, setToken, getInitData);

    await expect(client.get('/channels')).rejects.toEqual(
      expect.objectContaining({ statusCode: 401 }),
    );
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('throws typed ApiError on non-ok non-401 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          statusCode: 400,
          message: 'Bad Request',
          error: 'Bad Request',
        }),
    });

    const client = createApiClient(getToken, setToken, getInitData);

    await expect(client.post('/channels', { username: '' })).rejects.toEqual({
      statusCode: 400,
      message: 'Bad Request',
      error: 'Bad Request',
    });
  });

  it('handles 204 No Content responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    });

    const client = createApiClient(getToken, setToken, getInitData);
    const result = await client.del('/subscription-lists/123');

    expect(result).toBeUndefined();
  });
});
