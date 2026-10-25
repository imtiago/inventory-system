// modules/products/routes.tsx

import { Package } from "lucide-react";
import type { AppRoute } from "@/routes/types";
import { lazyPage } from '@/routes/lazyPage';

const ProductListPage = lazyPage(() => import('../pages/ProductListPage'), 'ProductListPage');
const ProductEditPage = lazyPage(() => import('../pages/ProductEditPage'), 'ProductEditPage');
const ProductDetailsPage = lazyPage(() => import('../pages/ProductDetailsPage'), 'ProductDetailsPage');
const ProductCreatePage = lazyPage(() => import('../pages/ProductCreatePage'), 'ProductCreatePage');
const VariantCreatePage = lazyPage(() => import('../pages/VariantCreatePage'), 'VariantCreatePage');
const VariantEditPage = lazyPage(() => import('../pages/VariantEditPage'), 'VariantEditPage');

export const productRoutes: AppRoute[] = [
  {
    path: "/products", permission: "catalog.read", showInMenu: true, icon: Package, group: "Catálogo",
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
