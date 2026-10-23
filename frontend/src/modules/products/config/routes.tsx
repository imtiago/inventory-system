// modules/products/routes.tsx
import { ProductListPage } from "../pages/ProductListPage";
import { ProductEditPage } from "../pages/ProductEditPage";
import { ProductDetailsPage } from "../pages/ProductDetailsPage";

import { Package } from "lucide-react";
import type { AppRoute } from "@/routes/types";
import { ProductCreatePage } from "../pages/ProductCreatePage";
import { VariantCreatePage } from "../pages/VariantCreatePage";
import { VariantEditPage } from "../pages/VariantEditPage";

export const productRoutes: AppRoute[] = [
  {
    path: "/products", permission: "catalog.read", showInMenu: true, icon: Package,
    label: "Produtos",
    component: ProductListPage,
    guard: "auth",
  },
  {
    path: "/products/:id", permission: "catalog.read",
    label: "Detalhes do Produto",
    component: ProductDetailsPage,
    guard: "auth",
  },
  {
    path: "/products/:id/variants/new", permission: "catalog.write",
    label: "Nova Variante",
    component: VariantCreatePage,
    guard: "auth",
  },
  {
    label: "Editar Variante",
    path: "/variants/:variantId/edit", permission: "catalog.write",
    component: VariantEditPage,
    guard: "auth",
  },
  {
    path: "/products/new", permission: "catalog.write",
    label: "Novo Produto",
    component: ProductCreatePage,
    guard: "auth",
  },
  {
    path: "/products/:id/edit", permission: "catalog.write",
    label: "Editar Produto",
    component: ProductEditPage,
    guard: "auth",
  },
];
