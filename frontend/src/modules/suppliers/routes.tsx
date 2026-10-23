import { Truck } from 'lucide-react';
import type { AppRoute } from '@/routes/types';
import { SupplierListPage } from './pages/SupplierListPage';

export const supplierRoutes: AppRoute[] = [
  { path: '/suppliers', permission: 'purchases.read', showInMenu: true, icon: Truck, group: 'Compras', label: 'Fornecedores', component: SupplierListPage, guard: 'auth' },
];
