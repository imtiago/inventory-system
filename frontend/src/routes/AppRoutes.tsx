// src/routes/AppRoutes.tsx
import { Routes, Route } from "react-router-dom";

// Importa todas as rotas dos módulos
import { productRoutes } from "../modules/products/routes";
import { salesRoutes } from "../modules/sales/routes";
import { authRoutes } from "../modules/auth/routes";

// Juntando todas as rotas
const allRoutes = [
  ...productRoutes,
  ...salesRoutes,
  ...authRoutes,
  // ...adicione outros módulos aqui
];

export const AppRoutes = () => {
  return (
    <Routes>
      {allRoutes.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={route.element ? route.element : <route.component />}
        />
      ))}
      {/* rota fallback */}
      <Route path="*" element={<div>404 Not Found</div>} />
    </Routes>
  );
};
