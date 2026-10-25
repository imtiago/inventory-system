import { describe, expect, test, vi } from 'vitest';
import { screen } from '@testing-library/react';

import { AppRoutes } from '../AppRoutes';
import { renderWithProviders } from '@/test/render';

// A deploy removed the old chunk: the dynamic import of the page rejects.
vi.mock('@/modules/receivables/pages/ReceivableListPage', () => {
  throw new TypeError('Failed to fetch dynamically imported module: /assets/ReceivableListPage-old.js');
});

describe('rotas com carregamento sob demanda', () => {
  test('chunk de rota indisponível mostra "Nova versão disponível" dentro do layout (menu preservado)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithProviders(<AppRoutes />, { route: '/receivables' });

    expect(await screen.findByText(/Nova versão disponível/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
