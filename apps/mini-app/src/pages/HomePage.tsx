import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useSubscriptionLists } from '../hooks/useSubscriptionLists';
import { SubscriptionListCard } from '../components/SubscriptionListCard';
import { EmptyState } from '../components/EmptyState';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function HomePage() {
  const { lists, isLoading, error, refetch } = useSubscriptionLists();
  const navigate = useNavigate();

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center px-4">
        <p className="text-destructive text-sm">{error}</p>
        <Button variant="outline" size="sm" onClick={refetch}>
          <RefreshCw className="size-4 mr-2" />
          Try again
        </Button>
      </div>
    );
  }

  if (lists.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="p-4 pb-20">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Your Lists
      </div>
      {lists.map((list) => (
        <SubscriptionListCard key={list.id} list={list} />
      ))}
      <div className="fixed bottom-6 left-4 right-4">
        <Button className="w-full" onClick={() => navigate('/lists/new')}>
          <Plus className="size-4 mr-2" />
          Create List
        </Button>
      </div>
    </div>
  );
}
