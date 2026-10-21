// modules/sales/routes.tsx
import type { AppRoute } from '@/routes/types';
import { SalesPage } from './pages/SalesPage';
import { SaleListPage } from './pages/SaleListPage';
import { SaleCreatePage } from './pages/SaleCreatePage';

export const salesRoutes: AppRoute[] = [
  { path: '/sales', label: 'Vendas', component: SaleListPage, guard: 'auth' },
  { path: '/sales/new', label: 'Nova Venda', component: SaleCreatePage, guard: 'auth' },
];
