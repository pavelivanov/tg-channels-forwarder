import { useAuth } from '../context/AuthContext';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';

const guardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: '32px',
  textAlign: 'center',
};

export function TelegramGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, error } = useAuth();

  if (isLoading) {
    return (
      <div style={guardStyle}>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div style={guardStyle}>
        <ErrorMessage message={error} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={guardStyle}>
        <ErrorMessage message="Authentication failed. Please reopen the app." />
      </div>
    );
  }

  return <>{children}</>;
}
