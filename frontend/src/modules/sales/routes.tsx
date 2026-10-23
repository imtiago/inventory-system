// modules/sales/routes.tsx
import { ShoppingCart } from 'lucide-react';
import type { AppRoute } from '@/routes/types';
import { SaleListPage } from './pages/SaleListPage';
import { SaleCreatePage } from './pages/SaleCreatePage';
import { SaleDetailPage } from './pages/SaleDetailPage';

export const salesRoutes: AppRoute[] = [
  { path: '/sales', permission: 'sales.read', showInMenu: true, icon: ShoppingCart, label: 'Vendas', component: SaleListPage, guard: 'auth' },
  { path: '/sales/new', permission: 'sales.create', label: 'Nova Venda', component: SaleCreatePage, guard: 'auth' },
  { path: '/sales/:id', permission: 'sales.read', label: 'Detalhe da Venda', component: SaleDetailPage, guard: 'auth' },
];
