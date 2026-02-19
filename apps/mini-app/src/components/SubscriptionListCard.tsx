import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SubscriptionList } from '../types';

interface SubscriptionListCardProps {
  list: SubscriptionList;
}

export function SubscriptionListCard({ list }: SubscriptionListCardProps) {
  const navigate = useNavigate();

  const channelCount = list.sourceChannels.length;
  const channelText = channelCount === 1 ? '1 channel' : `${channelCount} channels`;

  return (
    <Card
      className="mb-2 cursor-pointer transition-transform duration-100 active:scale-[0.98] active:opacity-80"
      onClick={() => navigate(`/lists/${list.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') navigate(`/lists/${list.id}`);
      }}
    >
      <CardContent className="px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-base">{list.name}</span>
          <Badge variant={list.isActive ? 'default' : 'secondary'}>
            {list.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          {list.destinationUsername ? `@${list.destinationUsername}` : 'No destination'}
          {' \u00B7 '}
          {channelText}
        </div>
      </CardContent>
    </Card>
  );
}
