import type { AppRoute } from "@/routes/types";
import { InitialInventoryPage } from "../pages/InitialInventoryPage";

export const inventoryRoutes: AppRoute[] = [
  {
    path: "/inventory/initial",
    label: "Inventario",
    component: InitialInventoryPage,
    guard: "auth",
  },
];
