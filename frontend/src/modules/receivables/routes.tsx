import type { AppRoute } from '@/routes/types';
import { ReceivableDetailPage } from './pages/ReceivableDetailPage';
import { ReceivableListPage } from './pages/ReceivableListPage';

export const receivablesRoutes: AppRoute[] = [
  { path: '/receivables', label: 'Contas a receber', component: ReceivableListPage, guard: 'auth' },
  { path: '/receivables/:id', label: 'Conta a receber', component: ReceivableDetailPage, guard: 'auth' },
];
