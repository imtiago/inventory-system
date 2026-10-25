import axios from "axios";
import { toast } from "sonner";

import { queryClient } from "@/shared/react-query/queryClient";
import { useAuthStore, type SessionUser } from "@/shared/store/auth";

export const api = axios.create({
  // baseURL: "http://192.168.100.3:3000", // sua API
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3000",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

const FORBIDDEN_DEDUPE_MS = 3000;
let lastForbiddenAt = 0;

/** Global 403: tells the user once per burst and revalidates the session user (the role may have changed). */
function handleForbidden(url: unknown) {
  const now = Date.now();
  if (now - lastForbiddenAt > FORBIDDEN_DEDUPE_MS) {
    lastForbiddenAt = now;
    toast.error("Você não tem permissão para esta ação.", { id: "forbidden" });
  }

  if (typeof url === "string" && url.endsWith("/users/me")) return;
  api
    .get<{ data: SessionUser }>("/users/me")
    .then((response) => {
      queryClient.setQueryData(["auth", "me"], response.data.data);
      useAuthStore.getState().setUser(response.data.data);
    })
    .catch(() => {});
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLogin = typeof error.config?.url === "string" && error.config.url.endsWith("/auth/login");

    // Only the current session can expire: a late 401 after a voluntary logout, or for a request
    // sent with a token that was replaced meanwhile (password change), must not end the session.
    const sentAuth = error.config?.headers?.Authorization;
    const currentToken = useAuthStore.getState().token;
    const sentWithCurrentToken = !sentAuth || sentAuth === `Bearer ${currentToken}`;

    if (error.response?.status === 401 && !isLogin && currentToken && sentWithCurrentToken) {
      // Session ended: clear it (RouteGuard then sends the user to /login?expired=1 without a reload).
      useAuthStore.getState().logout(true);
      queryClient.clear();
    }

    if (error.response?.status === 403 && currentToken && sentWithCurrentToken) {
      handleForbidden(error.config?.url);
    }

    return Promise.reject(error);
  },
);
