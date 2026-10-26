import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';

import { server } from '@/test/server';
import { loginAs } from '@/test/auth';
import { API_URL } from '@/test/handlers/inventory';
import { renderWithProviders } from '@/test/render';
import { InventoryListPage } from '../InventoryListPage';

function row(over: Record<string, unknown>) {
  return {
    id: 'inv-1',
    productVariantId: 'v-1',
    quantity: 10,
    reservedQuantity: 0,
    availableQuantity: 10,
    expired: 0,
    minimumStock: 0,
    averageCost: 1,
    createdAt: '2026-10-01T00:00:00.000Z',
    productVariant: { id: 'v-1', code: 'COD-1', name: 'Variante 1', barcode: null, productId: 'p-1' },
    ...over,
  };
}

function listOf(...items: unknown[]) {
  return HttpResponse.json({ data: items, pagination: { page: 1, limit: 10, total: items.length, totalPages: 1 } });
}

describe('InventoryListPage', () => {
  test("lista não mostra 'undefined' durante o carregamento", async () => {
    server.use(
      http.get(`${API_URL}/inventory`, async () => {
        await new Promise((r) => setTimeout(r, 50));
        return listOf();
      }),
    );
    const { container } = renderWithProviders(<InventoryListPage />);
    expect(container.textContent).not.toContain('undefined');
    await screen.findByText('Nenhum item em estoque.');
    expect(container.textContent).not.toContain('undefined');
  });

  test('mostra carregando e depois o total em português', async () => {
    renderWithProviders(<InventoryListPage />);
    expect(screen.getByText('Carregando estoque...')).toBeInTheDocument();
    expect(await screen.findByText('2 itens em estoque')).toBeInTheDocument();
  });

  test('erro da API mostra mensagem com "Tentar novamente", não tabela vazia', async () => {
    let fail = true;
    server.use(
      http.get(`${API_URL}/inventory`, () =>
        fail ? HttpResponse.json({ message: 'Falha', code: 'INTERNAL_ERROR' }, { status: 500 }) : listOf(row({})),
      ),
    );
    renderWithProviders(<InventoryListPage />);

    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent('Não foi possível carregar o estoque.');
    expect(screen.queryByText('0 itens em estoque')).not.toBeInTheDocument();
    expect(screen.queryByText('Nenhum item em estoque.')).not.toBeInTheDocument();

    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('COD-1')).toBeInTheDocument();
  });

  test('sem itens mostra estado vazio', async () => {
    server.use(http.get(`${API_URL}/inventory`, () => listOf()));
    renderWithProviders(<InventoryListPage />);
    expect(await screen.findByText('Nenhum item em estoque.')).toBeInTheDocument();
  });

  test('Status é calculado: Sem estoque, Reservado e Disponível', async () => {
    server.use(
      http.get(`${API_URL}/inventory`, () =>
        listOf(
          row({ id: 'a', quantity: 0, availableQuantity: 0, productVariant: { id: 'a', code: 'COD-A', name: 'Nome A', barcode: null, productId: 'p' } }),
          row({ id: 'b', quantity: 10, reservedQuantity: 3, availableQuantity: 7, productVariant: { id: 'b', code: 'COD-B', name: 'Nome B', barcode: null, productId: 'p' } }),
          row({ id: 'c', quantity: 10, availableQuantity: 10, productVariant: { id: 'c', code: 'COD-C', name: 'Nome C', barcode: null, productId: 'p' } }),
        ),
      ),
    );
    renderWithProviders(<InventoryListPage />);
    await screen.findByText('3 itens em estoque');

    const byCode = (code: string) => screen.getByText(code).closest('tr') as HTMLElement;
    expect(byCode('COD-A')).toHaveTextContent('Sem estoque');
    expect(byCode('COD-B')).toHaveTextContent('Reservado');
    expect(byCode('COD-C')).toHaveTextContent('Disponível');
  });

  test('"Cenário Inicial" (escrita de estoque) não aparece para quem só lê estoque; "Novo" segue catalog.write', async () => {
    loginAs('VENDEDOR');
    renderWithProviders(<InventoryListPage />);
    await screen.findByText('2 itens em estoque');
    expect(screen.queryByRole('link', { name: /Cenário Inicial/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Novo/ })).toBeInTheDocument();
  });

  test('coluna de estoque mostra "Vencido: n" quando há vencido', async () => {
    server.use(http.get(`${API_URL}/inventory`, () => listOf(row({ expired: 3 }))));
    renderWithProviders(<InventoryListPage />);
    expect(await screen.findByText('Vencido: 3')).toBeInTheDocument();
  });
});
