import { Routes, Route, Navigate } from 'react-router-dom';

import { RouteGuard } from './RouteGuard';
import { useAuth } from '../shared/hooks/useAuth';

import { productRoutes } from '../modules/products/config/routes';
import { inventoryRoutes } from '@/modules/inventory/config/routes';
import { salesRoutes } from '../modules/sales/routes';
import { authRoutes } from '../modules/auth/routes';
import type { AppRoute } from './types';
import { dashboardRoutes } from '@/modules/dashboard/routes';
import { DashboardLayout } from '@/shared/layouts/DashboardLayout';
import { customersRoutes } from '@/modules/customers/config/routes';

const allRoutes: AppRoute[] = [...productRoutes, ...salesRoutes, ...dashboardRoutes, ...inventoryRoutes, ...customersRoutes];
const publicRoutes = [...authRoutes];
export const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {publicRoutes.map((route) => {
        const element = route.element ? route.element : <route.component />;

        return <Route key={route.path} path={route.path} element={<RouteGuard guard={route.guard}>{element}</RouteGuard>} />;
      })}

      <Route
        element={
          <RouteGuard guard="auth">
            <DashboardLayout />
          </RouteGuard>
        }
      >
        {allRoutes.map((route) => {
          const element = route.element ? route.element : <route.component />;
          return <Route key={route.path} path={route.path} element={<RouteGuard guard={route.guard}>{element}</RouteGuard>} />;
        })}
      </Route>
      <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
    </Routes>
  );
};
