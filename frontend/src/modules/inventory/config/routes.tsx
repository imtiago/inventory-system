import type { AppRoute } from '@/routes/types';
import { InitialInventoryPage } from '../pages/InitialInventoryPage';
import { InventoryListPage } from '../pages/InventoryListPage';
import { InventoryDetailsPage } from '../pages/InventoryDetailsPage';

export const inventoryRoutes: AppRoute[] = [
  {
    path: '/inventory',
    label: 'Inventario',
    component: InventoryListPage,
    guard: 'auth',
  },
  {
    path: '/inventory/initial',
    label: 'Inventario',
    component: InitialInventoryPage,
    guard: 'auth',
  },
  {
    path: '/inventory/:id',
    label: 'Detalhes do inventario',
    component: InventoryDetailsPage,
    guard: 'auth',
  },
];
