import type { AppRoute } from "@/routes/types";
import { DashboardPage } from "./pages/DashboardPage";

export const dashboardRoutes: AppRoute[] = [
  {
    path: "/",
    component: DashboardPage,
    guard: "auth",
    label: "Dashboard",
  },
];
