import { create } from "zustand";

import type { UserRole } from "@/shared/auth/permissions";
import { queryClient } from "@/shared/react-query/queryClient";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

type AuthState = {
  token: string | null;
  user: SessionUser | null;
  sessionExpired: boolean;
  setSession: (token: string, user: SessionUser) => void;
  setUser: (user: SessionUser) => void;
  /** Replaces the token of the current session (e.g. after a password change), keeping the user. */
  setToken: (token: string) => void;
  /** Clears token and user. `expired` marks a forced logout (401). Callers must also clear the query cache. */
  logout: (expired?: boolean) => void;
};

function readToken() {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: readToken(),
  user: null,
  sessionExpired: false,

  setSession: (token, user) => {
    // A new login must never see data cached by a previous session.
    queryClient.clear();
    localStorage.setItem("token", token);
    set({ token, user, sessionExpired: false });
  },

  setUser: (user) => {
    if (get().token) set({ user });
  },

  setToken: (token) => {
    if (!get().token) return;
    localStorage.setItem("token", token);
    set({ token });
  },

  logout: (expired = false) => {
    // Only remove our own token: another tab may already have stored a newer one (password change).
    if (localStorage.getItem("token") === get().token) localStorage.removeItem("token");
    set({ token: null, user: null, sessionExpired: expired });
  },
}));
