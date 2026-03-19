// modules/products/routes.tsx
import { ProductListPage } from "./pages/ProductListPage";
import { ProductFormPage } from "./pages/ProductFormPage";
import { ProductEditPage } from "./pages/ProductEditPage";

export const productRoutes = [
  { path: "/products", name: "Produtos", component: ProductListPage },
  { path: "/products/new", name: "Novo Produto", component: ProductFormPage },
  {
    path: "/products/edit/:id",
    name: "Editar Produto",
    component: ProductEditPage,
  },
];
