import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuthStore, type SessionUser } from "../store/auth";
import { api } from "@/shared/services/api";

async function getAuthenticatedUser(): Promise<SessionUser> {
  const response = await api.get<{ data: SessionUser }>("/users/me");
  return response.data.data;
}

export function useAuth() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  const setUser = useAuthStore((s) => s.setUser);

  // Restores the session on load and revalidates (role/active) in the background.
  const userQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getAuthenticatedUser,
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (userQuery.data) setUser(userQuery.data);
  }, [userQuery.data, setUser]);

  return {
    token,
    user,
    sessionExpired,
    // Until /users/me resolves (or fails) there is a token but no user yet: wait instead of redirecting.
    isRestoring: !!token && !user && !userQuery.isError,
    isAuthenticated: !!token && !!user,
  };
}
