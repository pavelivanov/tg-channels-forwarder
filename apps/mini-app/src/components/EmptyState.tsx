import { ListPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function EmptyState() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center px-4">
      <ListPlus className="size-12 text-muted-foreground" />
      <p className="text-muted-foreground text-base">
        No subscription lists yet
      </p>
      <Button onClick={() => navigate('/lists/new')}>
        Create your first list
      </Button>
    </div>
  );
}
