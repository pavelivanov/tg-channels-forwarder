import { useNavigate } from 'react-router-dom';
import { useSubscriptionLists } from '../hooks/useSubscriptionLists';
import { SubscriptionListCard } from '../components/SubscriptionListCard';
import { EmptyState } from '../components/EmptyState';
import { ErrorMessage } from '../components/ErrorMessage';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function HomePage() {
  const { lists, isLoading, error } = useSubscriptionLists();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-[68px] w-full rounded-xl mb-2" />
        <Skeleton className="h-[68px] w-full rounded-xl mb-2" />
        <Skeleton className="h-[68px] w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <ErrorMessage message={error} />
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
          Create List
        </Button>
      </div>
    </div>
  );
}
