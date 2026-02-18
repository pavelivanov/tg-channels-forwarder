import { useNavigate } from 'react-router-dom';
import { useSubscriptionLists } from '../hooks/useSubscriptionLists';
import { SubscriptionListCard } from '../components/SubscriptionListCard';
import { EmptyState } from '../components/EmptyState';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

const headerStyle: React.CSSProperties = {
  color: 'var(--section-header-color)',
  fontSize: 14,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 8,
};

const fabStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 24,
  left: 16,
  right: 16,
};

const premiumLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--hint-color)',
  marginTop: 4,
  textAlign: 'center',
};

export function HomePage() {
  const { lists, isLoading, error } = useSubscriptionLists();
  const navigate = useNavigate();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="container">
        <ErrorMessage message={error} />
      </div>
    );
  }

  if (lists.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      <div style={headerStyle}>Your Lists</div>
      {lists.map((list) => (
        <SubscriptionListCard key={list.id} list={list} />
      ))}
      <div style={fabStyle}>
        <button onClick={() => navigate('/lists/new')}>Create List</button>
        <div style={premiumLabelStyle} />
      </div>
    </div>
  );
}
