import { beforeEach, describe, expect, test, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';

import { ProductListPage } from '../ProductListPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import productList from '@/test/fixtures/catalog/productList.json';
import brandList from '@/test/fixtures/catalog/brandList.json';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const requests: URL[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  requests.length = 0;
  server.use(
    http.get(`${API_URL}/products`, ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json({ ...productList, pagination: { ...productList.pagination, total: 25, totalPages: 3 } });
    }),
    http.get(`${API_URL}/brands`, ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json(brandList);
    }),
    http.get(`${API_URL}/categories`, ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json({ data: [{ id: 'cat-1', name: 'Perfumes', productsCount: 1 }], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } });
    }),
  );
});

const productRequests = () => requests.filter((url) => url.pathname.endsWith('/products'));

describe('ProductListPage', () => {
  test('título usa pagination.total e a busca só é enviada após o debounce', async () => {
    renderWithProviders(<ProductListPage />);
    expect(await screen.findByText('Produtos (25)')).toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
    expect(productRequests()[0].searchParams.get('search')).toBeNull();

    await userEvent.type(screen.getByLabelText('Buscar produtos'), 'batom');

    await waitFor(() => expect(productRequests().at(-1)!.searchParams.get('search')).toBe('batom'));
    // typed 5 chars but debounced: never one request per keystroke
    expect(productRequests().filter((url) => url.searchParams.get('search')).length).toBe(1);
  });

  test('filtros enviam brandId/categoryId e voltam para a página 1', async () => {
    renderWithProviders(<ProductListPage />);
    await screen.findByText('Produtos (25)');

    await userEvent.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(productRequests().at(-1)!.searchParams.get('page')).toBe('2'));

    await userEvent.selectOptions(await screen.findByLabelText('Filtrar por marca'), brandList.data[0].id);
    await waitFor(() => {
      const last = productRequests().at(-1)!;
      expect(last.searchParams.get('brandId')).toBe(brandList.data[0].id);
      expect(last.searchParams.get('page')).toBe('1');
    });

    await userEvent.selectOptions(screen.getByLabelText('Filtrar por categoria'), 'cat-1');
    await waitFor(() => expect(productRequests().at(-1)!.searchParams.get('categoryId')).toBe('cat-1'));
  });

  test('dropdowns pedem limit=100', async () => {
    renderWithProviders(<ProductListPage />);
    await screen.findByText('Produtos (25)');
    await waitFor(() => expect(requests.filter((url) => /\/(brands|categories)$/.test(url.pathname)).length).toBe(2));
    for (const url of requests.filter((u) => /\/(brands|categories)$/.test(u.pathname))) {
      expect(url.searchParams.get('limit')).toBe('100');
    }
  });

  test('excluir pede confirmação e 409 PRODUCT_IN_USE mostra a mensagem uma vez', async () => {
    const message = 'Produto possui movimentações, vendas ou compras e não pode ser excluído.';
    let deletes = 0;
    server.use(
      http.delete(`${API_URL}/products/:id`, () => {
        deletes += 1;
        return HttpResponse.json({ message, code: 'PRODUCT_IN_USE' }, { status: 409 });
      }),
    );
    renderWithProviders(<ProductListPage />);
    await screen.findByText('Perfume Floral 100ml');

    await userEvent.click(screen.getByRole('button', { name: 'Excluir Perfume Floral 100ml' }));
    expect(deletes).toBe(0);
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith(message);
    expect(deletes).toBe(1);
    expect(screen.queryByText('Excluir produto')).not.toBeInTheDocument();
  });

  test('cancelar a confirmação não exclui', async () => {
    let deletes = 0;
    server.use(http.delete(`${API_URL}/products/:id`, () => ((deletes += 1), new HttpResponse(null, { status: 204 }))));
    renderWithProviders(<ProductListPage />);
    await screen.findByText('Perfume Floral 100ml');
    await userEvent.click(screen.getByRole('button', { name: 'Excluir Perfume Floral 100ml' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(deletes).toBe(0);
  });
});
