// modules/sales/routes.tsx
import type { AppRoute } from "@/routes/types";
import { SalesPage } from "./pages/SalesPage";

export const salesRoutes: AppRoute[] = [
  { path: "/sales", label: "Vendas", component: SalesPage, guard: "auth" },
];
