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

const TOKEN_KEY = "token";

/** localStorage can throw on access (private mode, blocked site data): then the session just isn't persisted. */
function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Not persisted: the session lives in memory for this tab only.
  }
}

function removeToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing persisted to remove.
  }
}

/** The `sub` (user id) of a JWT, or null if it can't be decoded. Used only to tell "same user" from "other user". */
function tokenSubject(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const sub = (JSON.parse(json) as { sub?: unknown }).sub;
    return typeof sub === "string" ? sub : null;
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
    writeToken(token);
    set({ token, user, sessionExpired: false });
  },

  setUser: (user) => {
    if (get().token) set({ user });
  },

  setToken: (token) => {
    if (!get().token) return;
    writeToken(token);
    set({ token });
  },

  logout: (expired = false) => {
    // Only remove our own token: another tab may already have stored a newer one (password change).
    if (readToken() === get().token) removeToken();
    set({ token: null, user: null, sessionExpired: expired });
  },
}));

/**
 * Keeps this tab in sync with the token written by another tab (the `storage` event only fires in
 * the OTHER tabs, so this never reacts to our own writes).
 * - token removed: logout here too;
 * - token replaced by one for the same user (password change): just adopt it;
 * - token set for another user, or after being logged out here (login elsewhere): drop the query
 *   cache and the user, so `/users/me` is refetched and no data of a previous user is shown.
 */
export function handleStorageEvent(event: Pick<StorageEvent, "key" | "newValue">) {
  // key === null means the whole storage was cleared.
  if (event.key !== null && event.key !== TOKEN_KEY) return;
  const state = useAuthStore.getState();
  const next = event.key === null ? readToken() : event.newValue;

  if (next === state.token) return;

  if (!next) {
    useAuthStore.setState({ token: null, user: null, sessionExpired: false });
    queryClient.clear();
    return;
  }

  const sameUser = !!state.token && !!state.user && tokenSubject(next) === state.user.id;
  if (sameUser) {
    useAuthStore.setState({ token: next });
    return;
  }
  queryClient.clear();
  useAuthStore.setState({ token: next, user: null, sessionExpired: false });
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", handleStorageEvent);
}
