// modules/products/routes.tsx
import { ProductListPage } from "../pages/ProductListPage";
import { ProductEditPage } from "../pages/ProductEditPage";
import { ProductDetailsPage } from "../pages/ProductDetailsPage";

import type { AppRoute } from "@/routes/types";
import { ProductCreatePage } from "../pages/ProductCreatePage";
import { VariantCreatePage } from "../pages/VariantCreatePage";
import { VariantEditPage } from "../pages/VariantEditPage";

export const productRoutes: AppRoute[] = [
  {
    path: "/products",
    label: "Produtos",
    component: ProductListPage,
    guard: "auth",
  },
  {
    path: "/products/:id",
    label: "Detalhes do Produto",
    component: ProductDetailsPage,
    guard: "auth",
  },
  {
    path: "/products/:id/variants/new",
    label: "Nova Variante",
    component: VariantCreatePage,
    guard: "auth",
  },
  {
    label: "Editar Variante",
    path: "/variants/:variantId/edit",
    component: VariantEditPage,
    guard: "auth",
  },
  {
    path: "/products/new",
    label: "Novo Produto",
    component: ProductCreatePage,
    guard: "auth",
  },
  {
    path: "/products/:id/edit",
    label: "Editar Produto",
    component: ProductEditPage,
    guard: "auth",
  },
];
