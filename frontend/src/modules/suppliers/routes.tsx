import { Truck } from 'lucide-react';
import type { AppRoute } from '@/routes/types';
import { lazyPage } from '@/routes/lazyPage';

const SupplierListPage = lazyPage(() => import('./pages/SupplierListPage'), 'SupplierListPage');

export const supplierRoutes: AppRoute[] = [
  { path: '/suppliers', permission: 'purchases.read', showInMenu: true, icon: Truck, group: 'Compras', label: 'Fornecedores', component: SupplierListPage, guard: 'auth' },
];
