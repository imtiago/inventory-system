// modules/sales/routes.tsx
import { Ban, ShoppingCart } from 'lucide-react';
import type { AppRoute } from '@/routes/types';
import { lazyPage } from '@/routes/lazyPage';

const SaleListPage = lazyPage(() => import('./pages/SaleListPage'), 'SaleListPage');
const SaleCreatePage = lazyPage(() => import('./pages/SaleCreatePage'), 'SaleCreatePage');
const SaleCancelRequestsPage = lazyPage(() => import('./pages/SaleCancelRequestsPage'), 'SaleCancelRequestsPage');
const SaleDetailPage =lazyPage(() => import('./pages/SaleDetailPage'), 'SaleDetailPage');

export const salesRoutes: AppRoute[] = [
  { path: '/sales', permission: 'sales.read', showInMenu: true, icon: ShoppingCart, label: 'Vendas', component: SaleListPage, guard: 'auth' },
  { path: '/sales/new', permission: 'sales.create', label: 'Nova Venda', component: SaleCreatePage, guard: 'auth' },
  { path: '/sales/cancel-requests', permission: 'sales.cancel', showInMenu: true, icon: Ban, label: 'Pedidos de cancelamento', group: 'Vendas', component: SaleCancelRequestsPage, guard: 'auth' },
  { path: '/sales/:id', permission: 'sales.read', label: 'Detalhe da Venda', component: SaleDetailPage, guard: 'auth' },
];
