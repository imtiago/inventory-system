import { Percent } from 'lucide-react';

import type { AppRoute } from '@/routes/types';
import { lazyPage } from '@/routes/lazyPage';

const PricingSettingsPage = lazyPage(() => import('./pages/PricingSettingsPage'), 'PricingSettingsPage');

export const pricingRoutes: AppRoute[] = [
  { path: '/settings/pricing', label: 'Preços', component: PricingSettingsPage, guard: 'auth', permission: 'pricing.manage', showInMenu: true, icon: Percent, group: 'Configurações' },
];
