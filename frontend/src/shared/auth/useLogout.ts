import { useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/shared/store/auth";

/** Clears session and the active query cache so the next user never sees previous data. */
export function useLogout() {
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);

  return () => {
    logout();
    queryClient.clear();
  };
}
