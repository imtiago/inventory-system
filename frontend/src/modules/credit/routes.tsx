import { HandCoins } from 'lucide-react';

import type { AppRoute } from '@/routes/types';
import { lazyPage } from '@/routes/lazyPage';

const CreditSettingsPage = lazyPage(() => import('./pages/CreditSettingsPage'), 'CreditSettingsPage');

export const creditRoutes: AppRoute[] = [
  { path: '/settings/credit', label: 'Crediário', component: CreditSettingsPage, guard: 'auth', permission: 'credit.manage', showInMenu: true, icon: HandCoins, group: 'Configurações' },
];
