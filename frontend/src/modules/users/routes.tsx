import { UserCog } from 'lucide-react';

import type { AppRoute } from '@/routes/types';
import { lazyPage } from '@/routes/lazyPage';

const UserListPage = lazyPage(() => import('./pages/UserListPage'), 'UserListPage');

export const usersRoutes: AppRoute[] = [
  {
    path: '/users',
    label: 'Usuários',
    component: UserListPage,
    guard: 'auth',
    permission: 'users.manage',
    showInMenu: true,
    icon: UserCog,
  },
];
