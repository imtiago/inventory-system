import { describe, expect, test } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { SaleListPage } from '../SaleListPage';
import { ProductListPage } from '@/modules/products/pages/ProductListPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';

const empty = { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } };

describe('Listas vazias dizem o que está vazio (M1)', () => {
  test('vendas', async () => {
    server.use(http.get(`${API_URL}/sales`, () => HttpResponse.json(empty)));
    renderWithProviders(<SaleListPage />);
    expect(await screen.findByText('Nenhuma venda encontrada')).toBeInTheDocument();
    expect(screen.queryByText(/nenhum cliente/i)).not.toBeInTheDocument();
  });

  test('produtos', async () => {
    server.use(
      http.get(`${API_URL}/products`, () => HttpResponse.json(empty)),
      http.get(`${API_URL}/brands`, () => HttpResponse.json(empty)),
      http.get(`${API_URL}/categories`, () => HttpResponse.json(empty)),
    );
    renderWithProviders(<ProductListPage />);
    expect(await screen.findByText('Nenhum produto encontrado')).toBeInTheDocument();
  });
});
