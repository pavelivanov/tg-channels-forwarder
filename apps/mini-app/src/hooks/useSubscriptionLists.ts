import { useCallback, useEffect, useState } from 'react';
import { useApi } from './useApi';
import type { SubscriptionList } from '../types';

export function useSubscriptionLists() {
  const api = useApi();
  const [lists, setLists] = useState<SubscriptionList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLists = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<SubscriptionList[]>('/subscription-lists');
      setLists(data);
    } catch {
      setError('Failed to load subscription lists');
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const deleteList = useCallback(
    async (id: string) => {
      await api.del(`/subscription-lists/${id}`);
      setLists((prev) => prev.filter((l) => l.id !== id));
    },
    [api],
  );

  return { lists, isLoading, error, refetch: fetchLists, deleteList };
}
