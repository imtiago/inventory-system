import { Tag } from 'lucide-react';

import type { AppRoute } from '@/routes/types';
import { lazyPage } from '@/routes/lazyPage';

const BrandListPage = lazyPage(() => import('./pages/BrandListPage'), 'BrandListPage');

export const brandRoutes: AppRoute[] = [
  { path: '/brands', label: 'Marcas', component: BrandListPage, guard: 'auth', permission: 'catalog.read', showInMenu: true, icon: Tag, group: 'Catálogo' },
];
