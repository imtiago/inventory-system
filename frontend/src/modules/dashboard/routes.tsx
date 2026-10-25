import { LayoutDashboard } from "lucide-react";
import type { AppRoute } from "@/routes/types";
import { lazyPage } from '@/routes/lazyPage';

const DashboardPage = lazyPage(() => import('./pages/DashboardPage'), 'DashboardPage');

export const dashboardRoutes: AppRoute[] = [
  {
    path: "/", showInMenu: true, icon: LayoutDashboard,
    component: DashboardPage,
    guard: "auth",
    label: "Dashboard",
  },
];
