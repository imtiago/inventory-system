import { Receipt } from 'lucide-react';
import type { AppRoute } from '@/routes/types';
import { lazyPage } from '@/routes/lazyPage';

const PayableDetailPage = lazyPage(() => import('./pages/PayableDetailPage'), 'PayableDetailPage');
const PayableListPage = lazyPage(() => import('./pages/PayableListPage'), 'PayableListPage');

export const payablesRoutes: AppRoute[] = [
  { path: '/payables', permission: 'payables.read', showInMenu: true, icon: Receipt, group: 'Financeiro', label: 'Contas a pagar', component: PayableListPage, guard: 'auth' },
  { path: '/payables/:id', permission: 'payables.read', label: 'Conta a pagar', component: PayableDetailPage, guard: 'auth' },
];
