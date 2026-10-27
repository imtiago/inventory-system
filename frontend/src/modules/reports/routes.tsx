import { TrendingUp } from 'lucide-react';
import type { AppRoute } from '@/routes/types';
import { lazyPage } from '@/routes/lazyPage';

const ProfitReportPage = lazyPage(() => import('./pages/ProfitReportPage'), 'ProfitReportPage');

export const reportsRoutes: AppRoute[] = [
  { path: '/reports/profit', permission: 'reports.profit', showInMenu: true, icon: TrendingUp, group: 'Financeiro', label: 'Lucro', component: ProfitReportPage, guard: 'auth' },
];
