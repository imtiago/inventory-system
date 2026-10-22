import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';

import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { renderWithProviders } from '@/test/render';
import { InventoryListPage } from '../InventoryListPage';

describe('InventoryListPage', () => {
  test("lista não mostra 'undefined' durante o carregamento", async () => {
    server.use(http.get(`${API_URL}/inventory`, async () => {
      await new Promise((r) => setTimeout(r, 50));
      return HttpResponse.json({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
    }));
    const { container } = renderWithProviders(<InventoryListPage />);
    expect(container.textContent).not.toContain('undefined');
    await screen.findByText(/Items \(0\)/);
    expect(container.textContent).not.toContain('undefined');
  });
});
