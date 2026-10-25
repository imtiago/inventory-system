import { ClipboardList } from 'lucide-react';
import type { AppRoute } from '@/routes/types';
import { lazyPage } from '@/routes/lazyPage';

const PurchaseListPage = lazyPage(() => import('./pages/PurchaseListPage'), 'PurchaseListPage');
const PurchaseCreatePage = lazyPage(() => import('./pages/PurchaseCreatePage'), 'PurchaseCreatePage');
const PurchaseDetailPage = lazyPage(() => import('./pages/PurchaseDetailPage'), 'PurchaseDetailPage');

export const purchaseRoutes: AppRoute[] = [
  { path: '/purchases', permission: 'purchases.read', showInMenu: true, icon: ClipboardList, group: 'Compras', label: 'Pedidos de compra', component: PurchaseListPage, guard: 'auth' },
  { path: '/purchases/new', permission: 'purchases.write', label: 'Novo pedido de compra', component: PurchaseCreatePage, guard: 'auth' },
  { path: '/purchases/:id', permission: 'purchases.read', label: 'Pedido de compra', component: PurchaseDetailPage, guard: 'auth' },
];
