import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '../store/auth';
import { api } from '@/shared/services/api';

export interface IAuthenticatedUser {
  id: string;
  name: string;
  role: string;
  email: string;
  createdAt: string;
}

async function getAuthenticatedUser(): Promise<IAuthenticatedUser> {
  const response = await api.get<IAuthenticatedUser>('/users/me');
  return response.data;
}

export function useAuth() {
  const token = useAuthStore((state) => state.token);
  const setToken = useAuthStore((state) => state.setToken);
  const logout = useAuthStore((state) => state.logout);

  const userQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getAuthenticatedUser,
    enabled: !!token,
    retry: false,
  });

  return {
    token,
    user: userQuery.data ?? null,
    isLoadingUser: userQuery.isLoading,
    userError: userQuery.error,
    isAuthenticated: !!token,
    setToken,
    logout,
  };
}
