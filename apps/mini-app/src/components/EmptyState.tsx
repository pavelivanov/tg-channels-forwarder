import { useNavigate } from 'react-router-dom';

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 16px',
  textAlign: 'center',
};

const messageStyle: React.CSSProperties = {
  color: 'var(--hint-color)',
  fontSize: 16,
  marginBottom: 16,
};

export function EmptyState() {
  const navigate = useNavigate();

  return (
    <div style={containerStyle}>
      <p style={messageStyle}>No subscription lists yet</p>
      <button onClick={() => navigate('/lists/new')}>
        Create your first list
      </button>
    </div>
  );
}
