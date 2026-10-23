import { vi } from 'vitest';
import { namedEntityScenarios } from '@/test/namedEntityScenarios';
import { BrandListPage } from '../BrandListPage';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

namedEntityScenarios({
  Page: BrandListPage,
  path: 'brands',
  singular: 'marca',
  plural: 'marcas',
  existsCode: 'BRAND_ALREADY_EXISTS',
  existsMessage: 'Já existe uma marca com esse nome.',
  inUseCode: 'BRAND_IN_USE',
  inUseMessage: 'Marca possui produtos e não pode ser excluída.',
});
