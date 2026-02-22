import { useAuth } from '../context/AuthContext';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';

export function TelegramGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, error } = useAuth();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
        <ErrorMessage message={error} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
        <ErrorMessage message="Authentication failed. Please reopen the app." />
      </div>
    );
  }

  return <>{children}</>;
}
