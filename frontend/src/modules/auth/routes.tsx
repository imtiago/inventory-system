// src/modules/auth/routes.ts
import type { AppRoute } from "@/routes/types";
import { lazyPage } from '@/routes/lazyPage';

const Login = lazyPage(() => import('./pages/Login'), 'Login');

export const authRoutes: AppRoute[] = [
  {
    path: "/login",
    component: Login,
    guard: "public",
    label: "Login",
  },
];
