import { NotebookPen } from 'lucide-react';

import type { AppRoute } from '@/routes/types';
import { lazyPage } from '@/routes/lazyPage';

const LegacyImportListPage = lazyPage(() => import('./pages/LegacyImportListPage'), 'LegacyImportListPage');
const LegacyImportBatchPage = lazyPage(() => import('./pages/LegacyImportBatchPage'), 'LegacyImportBatchPage');
const LegacyQuickEntryPage = lazyPage(() => import('./pages/LegacyQuickEntryPage'), 'LegacyQuickEntryPage');

/** Migração do caderninho: só quem gerencia o crédito (ADMIN). */
export const legacyImportRoutes: AppRoute[] = [
  { path: '/finance/legacy-imports', label: 'Migração do caderninho', component: LegacyImportListPage, guard: 'auth', permission: 'credit.manage', showInMenu: true, icon: NotebookPen, group: 'Financeiro' },
  { path: '/finance/legacy-imports/quick', label: 'Lançamento rápido', component: LegacyQuickEntryPage, guard: 'auth', permission: 'credit.manage' },
  { path: '/finance/legacy-imports/:id', label: 'Lote do caderninho', component: LegacyImportBatchPage, guard: 'auth', permission: 'credit.manage' },
  { path: '/finance/legacy-imports/:id/quick', label: 'Lançamento rápido', component: LegacyQuickEntryPage, guard: 'auth', permission: 'credit.manage' },
];
