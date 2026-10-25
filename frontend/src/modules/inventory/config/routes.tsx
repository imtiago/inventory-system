import { Boxes } from 'lucide-react';
import type { AppRoute } from '@/routes/types';
import { lazyPage } from '@/routes/lazyPage';

const InitialInventoryPage = lazyPage(() => import('../pages/InitialInventoryPage'), 'InitialInventoryPage');
const InventoryListPage = lazyPage(() => import('../pages/InventoryListPage'), 'InventoryListPage');
const InventoryDetailsPage = lazyPage(() => import('../pages/InventoryDetailsPage'), 'InventoryDetailsPage');

export const inventoryRoutes: AppRoute[] = [
  {
    path: '/inventory', permission: 'inventory.read', showInMenu: true, icon: Boxes,
    label: 'Estoque',
    component: InventoryListPage,
    guard: 'auth',
  },
  {
    path: '/inventory/initial', permission: 'inventory.write',
    label: 'Inventário inicial',
    component: InitialInventoryPage,
    guard: 'auth',
  },
  {
    path: '/inventory/:id', permission: 'inventory.read',
    label: 'Detalhes do inventario',
    component: InventoryDetailsPage,
    guard: 'auth',
  },
];
