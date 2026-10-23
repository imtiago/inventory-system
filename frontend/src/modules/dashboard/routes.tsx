import { LayoutDashboard } from "lucide-react";
import type { AppRoute } from "@/routes/types";
import { DashboardPage } from "./pages/DashboardPage";

export const dashboardRoutes: AppRoute[] = [
  {
    path: "/", showInMenu: true, icon: LayoutDashboard,
    component: DashboardPage,
    guard: "auth",
    label: "Dashboard",
  },
];
