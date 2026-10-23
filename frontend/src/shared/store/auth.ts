import { create } from "zustand";

import type { UserRole } from "@/shared/auth/permissions";

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
    localStorage.setItem("token", token);
    set({ token, user, sessionExpired: false });
  },

  setUser: (user) => {
    if (get().token) set({ user });
  },

  logout: (expired = false) => {
    localStorage.removeItem("token");
    set({ token: null, user: null, sessionExpired: expired });
  },
}));
