import { vi } from 'vitest';
import { namedEntityScenarios } from '@/test/namedEntityScenarios';
import { CategoryListPage } from '../CategoryListPage';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

namedEntityScenarios({
  Page: CategoryListPage,
  path: 'categories',
  singular: 'categoria',
  plural: 'categorias',
  existsCode: 'CATEGORY_ALREADY_EXISTS',
  existsMessage: 'Já existe uma categoria com esse nome.',
  inUseCode: 'CATEGORY_IN_USE',
  inUseMessage: 'Categoria possui produtos e não pode ser excluída.',
});
