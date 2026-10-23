// modules/sales/routes.tsx
import type { AppRoute } from '@/routes/types';
import { SaleListPage } from './pages/SaleListPage';
import { SaleCreatePage } from './pages/SaleCreatePage';
import { SaleDetailPage } from './pages/SaleDetailPage';

export const salesRoutes: AppRoute[] = [
  { path: '/sales', label: 'Vendas', component: SaleListPage, guard: 'auth' },
  { path: '/sales/new', label: 'Nova Venda', component: SaleCreatePage, guard: 'auth' },
  { path: '/sales/:id', label: 'Detalhe da Venda', component: SaleDetailPage, guard: 'auth' },
];
