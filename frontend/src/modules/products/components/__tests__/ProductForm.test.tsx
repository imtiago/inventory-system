import { beforeEach, describe, expect, test, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ProductForm } from '../ProductForm';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';

function validationError(errors: { field: string; message: string }[]) {
  const config = { headers: new AxiosHeaders() };
  const response = { status: 400, data: { message: 'Dados inválidos.', code: 'VALIDATION_ERROR', errors }, statusText: '', headers: {}, config } as AxiosResponse;
  return new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, response);
}

const emptyPage = { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } };

beforeEach(() => {
  server.use(
    http.get(`${API_URL}/brands`, () => HttpResponse.json(emptyPage)),
    http.get(`${API_URL}/categories`, () => HttpResponse.json(emptyPage)),
  );
});

describe('ProductForm', () => {
  test('mostra erro do backend para campo que o formulário não renderiza', async () => {
    renderWithProviders(
      <ProductForm
        title="Novo"
        description=""
        onSubmit={async () => { throw validationError([{ field: 'sku', message: 'SKU inválido.' }]); }}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /salvar|cadastrar|criar/i }));

    await waitFor(() => expect(screen.getByText('SKU inválido.')).toBeInTheDocument());
  });

  test('mostra erro inline do campo conhecido', async () => {
    renderWithProviders(
      <ProductForm
        title="Novo"
        description=""
        onSubmit={async () => { throw validationError([{ field: 'name', message: 'O nome é obrigatório.' }]); }}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /salvar|cadastrar|criar/i }));

    await waitFor(() => expect(screen.getByText('O nome é obrigatório.')).toBeInTheDocument());
  });

  test('dois cliques em salvar chamam onSubmit uma única vez', async () => {
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 100)));
    renderWithProviders(<ProductForm title="Novo" description="" onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.type(screen.getByLabelText('Nome'), 'Perfume');
    await userEvent.dblClick(screen.getByRole('button', { name: 'Salvar Produto' }));

    await waitFor(() => expect(screen.getByRole('button', { name: /salvando/i })).toBeDisabled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar Produto' })).toBeEnabled());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test('marca e categoria buscam no servidor (limit 20, com debounce) e mostram a seleção atual', async () => {
    const urls: URL[] = [];
    const page = (data: unknown[]) => ({ data, pagination: { page: 1, limit: 20, total: data.length, totalPages: 1 } });
    server.use(
      http.get(`${API_URL}/brands`, ({ request }) => {
        const url = new URL(request.url);
        urls.push(url);
        return HttpResponse.json(page(url.searchParams.get('search') === 'zeta' ? [{ id: 'b-101', name: 'Zeta', productsCount: 0 }] : [{ id: 'b-1', name: 'Alfa', productsCount: 0 }]));
      }),
      http.get(`${API_URL}/categories`, () => HttpResponse.json(page([{ id: 'c-1', name: 'Perfumes', productsCount: 0 }]))),
    );
    const onSubmit = vi.fn();
    renderWithProviders(
      <ProductForm
        title="Editar"
        description=""
        initialValues={{ name: 'Perfume', brandId: 'b-0', categoryId: 'c-0' }}
        initialBrand={{ id: 'b-0', name: 'Marca Atual', productsCount: 1 }}
        initialCategory={{ id: 'c-0', name: 'Categoria Atual', productsCount: 1 }}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );

    // current selection is visible even though it is not in the first page
    expect(screen.getByLabelText('Marca')).toHaveValue('Marca Atual');
    expect(screen.getByLabelText('Categoria')).toHaveValue('Categoria Atual');

    await userEvent.type(screen.getByLabelText('Marca'), 'zeta');
    await userEvent.click(await screen.findByRole('button', { name: /Zeta/ }));

    const searches = urls.map((url) => url.searchParams.get('search'));
    expect(searches).not.toContain('z');
    expect(searches).toContain('zeta');
    expect(urls.every((url) => url.searchParams.get('limit') === '20')).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Salvar Produto' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ brandId: 'b-101', categoryId: 'c-0' });
  });
});
