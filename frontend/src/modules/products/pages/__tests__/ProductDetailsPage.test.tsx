import { beforeEach, describe, expect, test, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';

import { QueryClient } from '@tanstack/react-query';
import { shouldRetryQuery } from '@/shared/react-query/queryClient';
import { ProductDetailsPage } from '../ProductDetailsPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import productDetail from '@/test/fixtures/catalog/productDetail.json';
import variantList from '@/test/fixtures/catalog/variantList.json';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const product = productDetail.data;
const variantPages: string[] = [];

function variantsPage(page: number) {
  const base = variantList.data[0];
  const count = page === 1 ? 10 : 2;
  const data = Array.from({ length: count }, (_, i) => ({ ...base, id: `v-${page}-${i}`, code: `V${page}${i}`, name: `Variante ${page}-${i}` }));
  return { data, pagination: { page, limit: 10, total: 12, totalPages: 2 } };
}

function renderDetails() {
  return renderWithProviders(
    <Routes>
      <Route path="/products/:id" element={<ProductDetailsPage />} />
      <Route path="/products" element={<div>lista de produtos</div>} />
    </Routes>,
    { route: `/products/${product.id}` },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  variantPages.length = 0;
  server.use(
    http.get(`${API_URL}/products/:id`, () => HttpResponse.json(productDetail)),
    http.get(`${API_URL}/products/:id/variants`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      variantPages.push(`${params.get('page')}/${params.get('limit')}`);
      return HttpResponse.json(variantsPage(Number(params.get('page') ?? 1)));
    }),
  );
});

describe('ProductDetailsPage', () => {
  test('estoque das variantes: uma única consulta em lote por página (sem GET por variante)', async () => {
    const batches: string[][] = [];
    let perVariant = 0;
    server.use(
      http.get(`${API_URL}/inventory`, ({ request }) => {
        const ids = (new URL(request.url).searchParams.get('productVariantIds') ?? '').split(',');
        batches.push(ids);
        return HttpResponse.json({
          data: ids.filter((id) => id !== 'v-1-1').map((id) => ({ productVariantId: id, quantity: 9, reserved: 1, available: 8 })),
        });
      }),
      http.get(`${API_URL}/inventory/variants/:variantId`, () => {
        perVariant += 1;
        return HttpResponse.json({ message: 'x', code: 'INVENTORY_NOT_FOUND' }, { status: 404 });
      }),
    );
    renderDetails();

    expect(await screen.findByText('Variante 1-0')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('8')).toHaveLength(9));
    expect(screen.getAllByText('Sem estoque')).toHaveLength(1);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(10);
    expect(perVariant).toBe(0);
  });

  test('falha na consulta de estoque mostra erro nas linhas, sem virar "Sem estoque"', async () => {
    server.use(http.get(`${API_URL}/inventory`, () => HttpResponse.json({ message: 'x', code: 'INTERNAL_ERROR' }, { status: 500 })));
    renderDetails();

    expect(await screen.findByText('Variante 1-0')).toBeInTheDocument();
    expect((await screen.findAllByText('Erro ao carregar estoque', {}, { timeout: 5000 })).length).toBe(10);
    expect(screen.queryByText('Sem estoque')).not.toBeInTheDocument();
  });

  test('mostra marca, categoria e contagem; 12 variantes: título mostra 12 e página 2 busca page=2', async () => {
    renderDetails();

    expect(await screen.findByText('Natura')).toBeInTheDocument();
    expect(screen.getByText('Perfumes')).toBeInTheDocument();
    expect(await screen.findByText('Variantes (12)')).toBeInTheDocument();
    expect(variantPages[0]).toBe('1/10');
    // info card uses product.variantsCount (2 in the fixture), not the page length
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));

    expect(await screen.findByText('Variante 2-0')).toBeInTheDocument();
    expect(variantPages).toContain('2/10');
    expect(screen.getByText('Variantes (12)')).toBeInTheDocument();
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
  });

  test('excluir produto pede confirmação e volta para a lista', async () => {
    let deletes = 0;
    server.use(http.delete(`${API_URL}/products/:id`, () => ((deletes += 1), new HttpResponse(null, { status: 204 }))));
    renderDetails();
    await screen.findByText('Natura');

    await userEvent.click(screen.getByRole('button', { name: /Excluir/ }));
    expect(deletes).toBe(0);
    const buttons = screen.getAllByRole('button', { name: 'Excluir' });
    await userEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByText('lista de produtos')).toBeInTheDocument();
    expect(deletes).toBe(1);
  });

  test('excluir produto com o retry real do app não trava nem mostra erro (detalhe removido, não refeito)', async () => {
    let detailGets = 0;
    let deleted = false;
    server.use(
      http.get(`${API_URL}/products/:id`, () => {
        detailGets += 1;
        return deleted ? HttpResponse.json({ message: 'nf', code: 'PRODUCT_NOT_FOUND' }, { status: 404 }) : HttpResponse.json(productDetail);
      }),
      http.delete(`${API_URL}/products/:id`, () => ((deleted = true), new HttpResponse(null, { status: 204 }))),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: shouldRetryQuery, retryDelay: 1000 }, mutations: { retry: false } } });
    renderWithProviders(
      <Routes>
        <Route path="/products/:id" element={<ProductDetailsPage />} />
        <Route path="/products" element={<div>lista de produtos</div>} />
      </Routes>,
      { route: `/products/${product.id}`, queryClient },
    );
    await screen.findByText('Natura');
    const before = detailGets;

    await userEvent.click(screen.getByRole('button', { name: /Excluir/ }));
    const buttons = screen.getAllByRole('button', { name: 'Excluir' });
    await userEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => expect(screen.getByText('lista de produtos')).toBeInTheDocument(), { timeout: 1000 });
    expect(screen.queryByText('Erro ao carregar produto')).not.toBeInTheDocument();
    expect(detailGets - before).toBe(0);
  });

  test('falha ao listar variantes mostra mensagem e "Tentar novamente" que refaz a consulta', async () => {
    let fail = true;
    server.use(
      http.get(`${API_URL}/products/:id/variants`, () =>
        fail ? HttpResponse.json({ message: 'boom' }, { status: 500 }) : HttpResponse.json(variantsPage(1)),
      ),
    );
    renderDetails();

    expect(await screen.findByText('Não foi possível carregar as variantes.')).toBeInTheDocument();
    expect(screen.queryByText('Variantes (0)')).not.toBeInTheDocument();

    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Variantes (12)')).toBeInTheDocument();
    expect(screen.queryByText('Não foi possível carregar as variantes.')).not.toBeInTheDocument();
  });

  test('não mostra cards de placeholder sem dados', async () => {
    renderDetails();
    await screen.findByText('Natura');

    expect(screen.queryByText('Estoque atual')).not.toBeInTheDocument();
    expect(screen.queryByText('Movimentações')).not.toBeInTheDocument();
    expect(screen.queryByText('--')).not.toBeInTheDocument();
  });
});
