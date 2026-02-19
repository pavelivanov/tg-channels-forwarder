import { useNavigate } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EmptyState() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <Inbox className="size-12 text-muted-foreground mb-3" />
      <p className="text-base text-muted-foreground mb-4">No subscription lists yet</p>
      <Button onClick={() => navigate('/lists/new')}>
        Create your first list
      </Button>
    </div>
  );
}
