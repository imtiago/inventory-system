import { FileUp } from 'lucide-react';
import type { AppRoute } from '@/routes/types';
import { lazyPage } from '@/routes/lazyPage';

const NfeImportListPage = lazyPage(() => import('./pages/NfeImportListPage'), 'NfeImportListPage');
const NfeImportReviewPage = lazyPage(() => import('./pages/NfeImportReviewPage'), 'NfeImportReviewPage');

export const nfeImportRoutes: AppRoute[] = [
  { path: '/nfe-imports', permission: 'purchases.write', showInMenu: true, icon: FileUp, group: 'Compras', label: 'Importar NF-e', component: NfeImportListPage, guard: 'auth' },
  { path: '/nfe-imports/:id', permission: 'purchases.write', label: 'Revisão da NF-e', component: NfeImportReviewPage, guard: 'auth' },
];
