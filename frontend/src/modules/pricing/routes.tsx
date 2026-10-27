import { Percent, Tags } from 'lucide-react';

import type { AppRoute } from '@/routes/types';
import { lazyPage } from '@/routes/lazyPage';

const PricingSettingsPage = lazyPage(() => import('./pages/PricingSettingsPage'), 'PricingSettingsPage');
const PriceReviewListPage = lazyPage(() => import('./pages/PriceReviewListPage'), 'PriceReviewListPage');

export const pricingRoutes: AppRoute[] = [
  { path: '/catalog/price-reviews', label: 'Preços para revisar', component: PriceReviewListPage, guard: 'auth', permission: 'catalog.price', showInMenu: true, icon: Tags, group: 'Catálogo' },
  { path: '/settings/pricing', label: 'Preços', component: PricingSettingsPage, guard: 'auth', permission: 'pricing.manage', showInMenu: true, icon: Percent, group: 'Configurações' },
];
