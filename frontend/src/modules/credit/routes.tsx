import { ClipboardCheck, HandCoins, Scale } from 'lucide-react';

import type { AppRoute } from '@/routes/types';
import { lazyPage } from '@/routes/lazyPage';

const CreditRequestsPage = lazyPage(() => import('./pages/CreditRequestsPage'), 'CreditRequestsPage');
const CreditReviewPage = lazyPage(() => import('./pages/CreditReviewPage'), 'CreditReviewPage');
const CreditSettingsPage = lazyPage(() => import('./pages/CreditSettingsPage'), 'CreditSettingsPage');

export const creditRoutes: AppRoute[] = [
  { path: '/credit/requests', label: 'Pedidos de crédito', component: CreditRequestsPage, guard: 'auth', permission: 'credit.approve', showInMenu: true, icon: Scale, group: 'Vendas' },
  { path: '/credit/review', label: 'Revisão de crédito', component: CreditReviewPage, guard: 'auth', permission: 'credit.manage', showInMenu: true, icon: ClipboardCheck, group: 'Vendas' },
  { path: '/settings/credit', label: 'Crediário', component: CreditSettingsPage, guard: 'auth', permission: 'credit.manage', showInMenu: true, icon: HandCoins, group: 'Configurações' },
];
