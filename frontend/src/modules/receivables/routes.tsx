import type { AppRoute } from '@/routes/types';
import { ReceivableListPage } from './pages/ReceivableListPage';

export const receivablesRoutes: AppRoute[] = [{ path: '/receivables', label: 'Contas a receber', component: ReceivableListPage, guard: 'auth' }];
