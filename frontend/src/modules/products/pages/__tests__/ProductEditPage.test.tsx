import { beforeEach, describe, expect, test, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { Route, Routes } from 'react-router-dom';

import { ProductEditPage } from '../ProductEditPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import productDetail from '@/test/fixtures/catalog/productDetail.json';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const product = productDetail.data;
const brands = [
  { id: product.brand.id, name: 'Natura', productsCount: 1 },
  { id: 'brand-2', name: 'Boticário', productsCount: 3 },
];
const categories = [{ id: product.category.id, name: 'Perfumes', productsCount: 1 }];
const page = (data: unknown[]) => ({ data, pagination: { page: 1, limit: 100, total: data.length, totalPages: 1 } });

const bodies: unknown[] = [];

function renderEdit() {
  return renderWithProviders(
    <Routes>
      <Route path="/products/:id/edit" element={<ProductEditPage />} />
      <Route path="/products/:id" element={<div>detalhe do produto</div>} />
    </Routes>,
    { route: `/products/${product.id}/edit` },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  bodies.length = 0;
  server.use(
    http.get(`${API_URL}/products/:id`, () => HttpResponse.json(productDetail)),
    http.get(`${API_URL}/brands`, () => HttpResponse.json(page(brands))),
    http.get(`${API_URL}/categories`, () => HttpResponse.json(page(categories))),
    http.put(`${API_URL}/products/:id`, async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json(productDetail);
    }),
  );
});

describe('ProductEditPage', () => {
  test('pré-preenche e trocar só a marca envia { brandId }, depois vai ao detalhe', async () => {
    renderEdit();

    expect(await screen.findByDisplayValue('Perfume Floral 100ml')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Fragrância floral amadeirada.')).toBeInTheDocument();
    expect(screen.getByLabelText('Marca')).toHaveValue(product.brand.name);
    expect(screen.getByLabelText('Categoria')).toHaveValue(product.category.name);

    await userEvent.click(screen.getByLabelText('Marca'));
    await userEvent.click(await screen.findByRole('button', { name: /Boticário/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Produto' }));

    expect(await screen.findByText('detalhe do produto')).toBeInTheDocument();
    expect(bodies).toEqual([{ brandId: 'brand-2' }]);
  });

  test('limpar a descrição envia { description: "" }', async () => {
    renderEdit();
    await screen.findByDisplayValue('Perfume Floral 100ml');
    await userEvent.clear(screen.getByDisplayValue('Fragrância floral amadeirada.'));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Produto' }));

    expect(await screen.findByText('detalhe do produto')).toBeInTheDocument();
    expect(bodies).toEqual([{ description: '' }]);
  });

  test('sem alterações não chama a API', async () => {
    renderEdit();
    await screen.findByDisplayValue('Perfume Floral 100ml');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Produto' }));

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('Nenhuma alteração para salvar.'));
    expect(bodies).toEqual([]);
    expect(screen.queryByText('detalhe do produto')).not.toBeInTheDocument();
  });

  test('erro de validação do backend aparece no campo e não navega', async () => {
    server.use(
      http.put(`${API_URL}/products/:id`, () =>
        HttpResponse.json({ message: 'Dados inválidos.', code: 'VALIDATION_ERROR', errors: [{ field: 'name', message: 'Nome deve ter ao menos 3 caracteres.' }] }, { status: 400 }),
      ),
    );
    renderEdit();
    const name = await screen.findByDisplayValue('Perfume Floral 100ml');
    await userEvent.clear(name);
    await userEvent.type(name, 'ab');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Produto' }));

    expect(await screen.findByText('Nome deve ter ao menos 3 caracteres.')).toBeInTheDocument();
    expect(screen.queryByText('detalhe do produto')).not.toBeInTheDocument();
  });

  test('404 BRAND_NOT_FOUND mostra toast com a mensagem', async () => {
    server.use(http.put(`${API_URL}/products/:id`, () => HttpResponse.json({ message: 'Marca não encontrada.', code: 'BRAND_NOT_FOUND' }, { status: 404 })));
    renderEdit();
    await screen.findByDisplayValue('Perfume Floral 100ml');
    await userEvent.click(screen.getByLabelText('Marca'));
    await userEvent.click(await screen.findByRole('button', { name: /Boticário/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Produto' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Marca não encontrada.'));
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});
