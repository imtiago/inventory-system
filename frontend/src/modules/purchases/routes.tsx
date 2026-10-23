import { ClipboardList } from 'lucide-react';
import type { AppRoute } from '@/routes/types';
import { PurchaseListPage } from './pages/PurchaseListPage';
import { PurchaseCreatePage } from './pages/PurchaseCreatePage';
import { PurchaseDetailPage } from './pages/PurchaseDetailPage';

export const purchaseRoutes: AppRoute[] = [
  { path: '/purchases', permission: 'purchases.read', showInMenu: true, icon: ClipboardList, group: 'Compras', label: 'Pedidos de compra', component: PurchaseListPage, guard: 'auth' },
  { path: '/purchases/new', permission: 'purchases.write', label: 'Novo pedido de compra', component: PurchaseCreatePage, guard: 'auth' },
  { path: '/purchases/:id', permission: 'purchases.read', label: 'Pedido de compra', component: PurchaseDetailPage, guard: 'auth' },
];
