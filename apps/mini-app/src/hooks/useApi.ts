import { useAuth } from '../context/AuthContext';

export function useApi() {
  const { api } = useAuth();
  return api;
}
