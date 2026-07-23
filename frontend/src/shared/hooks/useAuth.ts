import { useAuthStore } from "../store/auth";

export function useAuth() {
  const token = useAuthStore((state) => state.token);

  return {
    token,
    isAuthenticated: !!token,
    setToken: useAuthStore((state) => state.setToken),
    logout: useAuthStore((state) => state.logout),
  };
}
