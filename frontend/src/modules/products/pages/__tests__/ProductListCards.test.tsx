import { beforeEach, describe, expect, test, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { ProductListPage } from '../ProductListPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { loginAs } from '@/test/auth';
import { setViewport } from '@/test/viewport';
import { API_URL } from '@/test/handlers/inventory';
import productList from '@/test/fixtures/catalog/productList.json';
import brandList from '@/test/fixtures/catalog/brandList.json';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

beforeEach(() => {
  server.use(
    http.get(`${API_URL}/products`, () => HttpResponse.json(productList)),
    http.get(`${API_URL}/brands`, () => HttpResponse.json(brandList)),
    http.get(`${API_URL}/categories`, () => HttpResponse.json({ data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } })),
  );
});

describe('ProductListPage: tabela no desktop, cartões no celular', () => {
  test('no desktop é uma tabela com as ações inline', async () => {
    renderWithProviders(<ProductListPage />);
    await screen.findByText('Perfume Floral 100ml');

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excluir Perfume Floral 100ml' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Editar Perfume Floral 100ml' })).toBeInTheDocument();
  });

  test('no celular são cartões e a exclusão pelo menu "⋯" mantém a confirmação e o handler', async () => {
    setViewport(375);
    let deletes = 0;
    server.use(http.delete(`${API_URL}/products/:id`, () => ((deletes += 1), new HttpResponse(null, { status: 204 }))));
    renderWithProviders(<ProductListPage />);
    await screen.findByText('Perfume Floral 100ml');

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const card = screen.getAllByRole('listitem')[0];
    expect(within(card).getByText('P000123')).toBeInTheDocument();
    expect(within(card).getByText('Natura')).toBeInTheDocument();

    await userEvent.click(within(card).getByRole('button', { name: /Mais ações/ }));
    expect(within(card).getByRole('link', { name: 'Editar Perfume Floral 100ml' })).toHaveAttribute('href', '/products/3f1c2a7e-9b4d-4e21-8a6f-1c2d3e4f5a60/edit');
    await userEvent.click(within(card).getByRole('button', { name: 'Excluir Perfume Floral 100ml' }));

    expect(deletes).toBe(0);
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Excluir' }));
    await vi.waitFor(() => expect(deletes).toBe(1));
  });

  test('sem permissão de exclusão o menu só traz editar, igual à tabela', async () => {
    loginAs('VENDEDOR');
    setViewport(375);
    renderWithProviders(<ProductListPage />);
    await screen.findByText('Perfume Floral 100ml');

    const card = screen.getAllByRole('listitem')[0];
    await userEvent.click(within(card).getByRole('button', { name: /Mais ações/ }));

    expect(within(card).getByRole('link', { name: 'Editar Perfume Floral 100ml' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir Perfume Floral 100ml' })).not.toBeInTheDocument();
  });
});
