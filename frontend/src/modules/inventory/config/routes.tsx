import { Boxes } from 'lucide-react';
import type { AppRoute } from '@/routes/types';
import { InitialInventoryPage } from '../pages/InitialInventoryPage';
import { InventoryListPage } from '../pages/InventoryListPage';
import { InventoryDetailsPage } from '../pages/InventoryDetailsPage';

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
