import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';

import internalError from '@/test/fixtures/errors/internal.json';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { renderWithProviders } from '@/test/render';
import { VariantStock } from '../VariantStock';

describe('VariantStock', () => {
  test('VariantStock mostra disponível', async () => {
    renderWithProviders(<VariantStock variantId="a3d9e2f1-7c4b-4e8a-b5d6-1f2e3c4d5a60" />);
    expect(await screen.findByText('40')).toBeInTheDocument();
    expect(screen.getByText('Disp.')).toBeInTheDocument();
  });

  test("VariantStock sem inventário mostra 'Sem estoque'", async () => {
    server.use(
      http.get(`${API_URL}/inventory/variants/:variantId`, () =>
        HttpResponse.json({ message: 'Estoque não encontrado.', code: 'INVENTORY_NOT_FOUND' }, { status: 404 }),
      ),
    );
    renderWithProviders(<VariantStock variantId="x" />);
    expect(await screen.findByText('Sem estoque')).toBeInTheDocument();
  });

  test("VariantStock com erro de rede mostra 'Erro ao carregar estoque'", async () => {
    server.use(http.get(`${API_URL}/inventory/variants/:variantId`, () => HttpResponse.error()));
    renderWithProviders(<VariantStock variantId="x" />);
    expect(await screen.findByText('Erro ao carregar estoque')).toBeInTheDocument();
    expect(screen.queryByText('Sem estoque')).not.toBeInTheDocument();
  });

  test("VariantStock com 404 ROUTE_NOT_FOUND mostra 'Erro ao carregar estoque'", async () => {
    server.use(
      http.get(`${API_URL}/inventory/variants/:variantId`, () =>
        HttpResponse.json({ message: 'Rota não encontrada.', code: 'ROUTE_NOT_FOUND' }, { status: 404 }),
      ),
    );
    renderWithProviders(<VariantStock variantId="x" />);
    expect(await screen.findByText('Erro ao carregar estoque')).toBeInTheDocument();
    expect(screen.queryByText('Sem estoque')).not.toBeInTheDocument();
  });

  test("VariantStock com erro 500 mostra 'Erro ao carregar estoque'", async () => {
    server.use(http.get(`${API_URL}/inventory/variants/:variantId`, () => HttpResponse.json(internalError, { status: 500 })));
    renderWithProviders(<VariantStock variantId="x" />);
    expect(await screen.findByText('Erro ao carregar estoque', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByText('Sem estoque')).not.toBeInTheDocument();
  });
});
