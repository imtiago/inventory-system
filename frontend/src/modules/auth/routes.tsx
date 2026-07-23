// src/modules/auth/routes.ts
import type { AppRoute } from "@/routes/types";
import { Login } from "./pages/Login"; // named export

export const authRoutes: AppRoute[] = [
  {
    path: "/login",
    component: Login,
    guard: "public",
    label: "Login",
  },
];
