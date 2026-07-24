// modules/products/routes.tsx
import { ProductListPage } from "./pages/ProductListPage";
import { ProductFormPage } from "./pages/ProductFormPage";
import { ProductEditPage } from "./pages/ProductEditPage";
import { ProductDetailsPage } from "./pages/ProductDetailsPage";

import type { AppRoute } from "@/routes/types";

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
    path: "/products/new",
    label: "Novo Produto",
    component: ProductFormPage,
    guard: "auth",
  },
  {
    path: "/products/:id/edit",
    label: "Editar Produto",
    component: ProductEditPage,
    guard: "auth",
  },
];
