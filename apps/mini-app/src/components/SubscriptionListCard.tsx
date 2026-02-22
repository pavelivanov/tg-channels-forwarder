import { useNavigate } from 'react-router-dom';
import type { SubscriptionList } from '../types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface SubscriptionListCardProps {
  list: SubscriptionList;
}

export function SubscriptionListCard({ list }: SubscriptionListCardProps) {
  const navigate = useNavigate();

  const channelCount = list.sourceChannels.length;
  const channelText = channelCount === 1 ? '1 channel' : `${channelCount} channels`;

  return (
    <Card
      className="cursor-pointer transition-opacity active:opacity-70 mb-2"
      onClick={() => navigate(`/lists/${list.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') navigate(`/lists/${list.id}`);
      }}
    >
      <CardContent className="p-3 px-4">
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
