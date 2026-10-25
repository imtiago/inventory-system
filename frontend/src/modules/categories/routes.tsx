import { Layers } from 'lucide-react';

import type { AppRoute } from '@/routes/types';
import { lazyPage } from '@/routes/lazyPage';

const CategoryListPage = lazyPage(() => import('./pages/CategoryListPage'), 'CategoryListPage');

export const categoryRoutes: AppRoute[] = [
  { path: '/categories', label: 'Categorias', component: CategoryListPage, guard: 'auth', permission: 'catalog.read', showInMenu: true, icon: Layers, group: 'Catálogo' },
];
