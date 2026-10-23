import type { AppRoute } from "./types";
import { productRoutes } from "@/modules/products/config/routes";
import { inventoryRoutes } from "@/modules/inventory/config/routes";
import { salesRoutes } from "@/modules/sales/routes";
import { receivablesRoutes } from "@/modules/receivables/routes";
import { dashboardRoutes } from "@/modules/dashboard/routes";
import { usersRoutes } from "@/modules/users/routes";
import { customersRoutes } from "@/modules/customers/config/routes";

/** Authenticated routes; order defines the menu order. New modules (e.g. /users) just add their config here. */
export const allRoutes: AppRoute[] = [
  ...dashboardRoutes,
  ...productRoutes,
  ...salesRoutes,
  ...customersRoutes,
  ...inventoryRoutes,
  ...receivablesRoutes,
  ...usersRoutes,
];
