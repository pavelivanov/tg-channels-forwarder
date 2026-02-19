import { useNavigate } from 'react-router-dom';
import type { SubscriptionList } from '../types';

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--section-bg-color)',
  borderRadius: 12,
  padding: '12px 16px',
  marginBottom: 8,
  cursor: 'pointer',
  transition: 'opacity 0.2s',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 4,
};

const nameStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 16,
};

const badgeBase: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 10,
};

const detailStyle: React.CSSProperties = {
  color: 'var(--subtitle-color)',
  fontSize: 14,
};

interface SubscriptionListCardProps {
  list: SubscriptionList;
}

export function SubscriptionListCard({ list }: SubscriptionListCardProps) {
  const navigate = useNavigate();

  const badgeStyle: React.CSSProperties = {
    ...badgeBase,
    backgroundColor: list.isActive
      ? 'var(--accent-color)'
      : 'var(--hint-color)',
    color: 'var(--button-text-color)',
  };

  const channelCount = list.sourceChannels.length;
  const channelText = channelCount === 1 ? '1 channel' : `${channelCount} channels`;

  return (
    <div
      style={cardStyle}
      onClick={() => navigate(`/lists/${list.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') navigate(`/lists/${list.id}`);
      }}
    >
      <div style={headerStyle}>
        <span style={nameStyle}>{list.name}</span>
        <span style={badgeStyle}>{list.isActive ? 'Active' : 'Inactive'}</span>
      </div>
      <div style={detailStyle}>
        {list.destinationUsername ? `@${list.destinationUsername}` : 'No destination'}
        {' \u00B7 '}
        {channelText}
      </div>
    </div>
  );
}
