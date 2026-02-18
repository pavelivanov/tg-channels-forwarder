import { useCallback, useEffect, useState } from 'react';
import { useApi } from './useApi';
import type { ApiError, SourceChannel } from '../types';

export function useChannels() {
  const api = useApi();
  const [channels, setChannels] = useState<SourceChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<SourceChannel[]>('/channels')
      .then(setChannels)
      .catch(() => setError('Failed to load channels'))
      .finally(() => setIsLoading(false));
  }, [api]);

  const addChannel = useCallback(
    async (username: string): Promise<SourceChannel> => {
      const channel = await api.post<SourceChannel>('/channels', { username });
      setChannels((prev) => {
        if (prev.some((c) => c.id === channel.id)) return prev;
        return [...prev, channel];
      });
      return channel;
    },
    [api],
  );

  return { channels, isLoading, error, addChannel };
}

export function getApiErrorMessage(err: unknown): string {
  const apiErr = err as ApiError;
  if (Array.isArray(apiErr?.message)) return apiErr.message[0];
  if (typeof apiErr?.message === 'string') return apiErr.message;
  return 'An unexpected error occurred';
}
