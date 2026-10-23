import axios from "axios";

import { queryClient } from "@/shared/react-query/queryClient";
import { useAuthStore } from "@/shared/store/auth";

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLogin = typeof error.config?.url === "string" && error.config.url.endsWith("/auth/login");

    if (error.response?.status === 401 && !isLogin) {
      // Session ended: clear it (RouteGuard then sends the user to /login?expired=1 without a reload).
      useAuthStore.getState().logout(true);
      queryClient.clear();
    }

    return Promise.reject(error);
  },
);
