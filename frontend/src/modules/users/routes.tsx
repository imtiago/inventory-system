import { UserCog } from 'lucide-react';

import type { AppRoute } from '@/routes/types';
import { UserListPage } from './pages/UserListPage';

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
