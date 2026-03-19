import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProductListPage } from "@/modules/products/pages/ProductListPage";
import { ProductFormPage } from "@/modules/products/pages/ProductFormPage";
import { DashboardLayout } from "@/shared/layouts/DashboardLayout";
import { ProductEditPage } from "@/modules/products/pages/ProductEditPage";

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/products" element={<ProductListPage />} />
          <Route path="/products/new" element={<ProductFormPage />} />
          <Route path="/products/:id/edit" element={<ProductEditPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
