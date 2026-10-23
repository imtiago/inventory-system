import { Wallet } from 'lucide-react';
import type { AppRoute } from '@/routes/types';
import { ReceivableDetailPage } from './pages/ReceivableDetailPage';
import { ReceivableListPage } from './pages/ReceivableListPage';

export const receivablesRoutes: AppRoute[] = [
  { path: '/receivables', permission: 'finance.read', showInMenu: true, icon: Wallet, group: 'Financeiro', label: 'Contas a receber', component: ReceivableListPage, guard: 'auth' },
  { path: '/receivables/:id', permission: 'finance.read', label: 'Conta a receber', component: ReceivableDetailPage, guard: 'auth' },
];
