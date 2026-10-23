import { Routes, Route, Navigate } from 'react-router-dom';

import { RouteGuard } from './RouteGuard';
import { useAuth } from '../shared/hooks/useAuth';
import { authRoutes } from '../modules/auth/routes';
import { allRoutes } from './routes';
import { DashboardLayout } from '@/shared/layouts/DashboardLayout';

const publicRoutes = [...authRoutes];
export const AppRoutes = () => {
  const { isAuthenticated, isRestoring } = useAuth();

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
          return (
            <Route
              key={route.path}
              path={route.path}
              element={
                <RouteGuard guard={route.guard} permission={route.permission}>
                  {element}
                </RouteGuard>
              }
            />
          );
        })}
      </Route>
      <Route path="*" element={isRestoring ? null : <Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
    </Routes>
  );
};
