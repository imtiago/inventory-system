import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Login } from "@/modules/auth/pages/Login";
import { SalesPage } from "@/modules/sales/pages/SalesPage";

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/sales" element={<SalesPage />} />
      </Routes>
    </BrowserRouter>
  );
}
