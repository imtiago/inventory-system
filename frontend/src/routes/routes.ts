import type { AppRoute } from "./types";
import { productRoutes } from "@/modules/products/config/routes";
import { inventoryRoutes } from "@/modules/inventory/config/routes";
import { salesRoutes } from "@/modules/sales/routes";
import { receivablesRoutes } from "@/modules/receivables/routes";
import { payablesRoutes } from "@/modules/payables/routes";
import { supplierRoutes } from "@/modules/suppliers/routes";
import { purchaseRoutes } from "@/modules/purchases/routes";
import { nfeImportRoutes } from "@/modules/nfe-imports/routes";
import { dashboardRoutes } from "@/modules/dashboard/routes";
import { usersRoutes } from "@/modules/users/routes";
import { brandRoutes } from "@/modules/brands/routes";
import { categoryRoutes } from "@/modules/categories/routes";
import { pricingRoutes } from "@/modules/pricing/routes";
import { reportsRoutes } from "@/modules/reports/routes";
import { customersRoutes } from "@/modules/customers/config/routes";

/** Authenticated routes; order defines the menu order. New modules (e.g. /users) just add their config here. */
export const allRoutes: AppRoute[] = [
  ...dashboardRoutes,
  ...productRoutes,
  ...brandRoutes,
  ...categoryRoutes,
  ...salesRoutes,
  ...customersRoutes,
  ...inventoryRoutes,
  ...supplierRoutes,
  ...purchaseRoutes,
  ...nfeImportRoutes,
  ...receivablesRoutes,
  ...payablesRoutes,
  ...pricingRoutes,
  ...reportsRoutes,
  ...usersRoutes,
];
