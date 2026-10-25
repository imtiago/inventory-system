import { describe, expect, test } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { SaleListPage } from '../SaleListPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { setViewport } from '@/test/viewport';
import { API_URL } from '@/test/handlers/inventory';
import saleList from '@/test/fixtures/sales/saleList.json';

describe('SaleListPage: cabeçalho com várias ações', () => {
  test('no celular as exportações ficam no menu "Exportar" e "Nova Venda" continua visível', async () => {
    server.use(http.get(`${API_URL}/sales`, () => HttpResponse.json(saleList)));
    setViewport(375);
    renderWithProviders(<SaleListPage />);
    await screen.findByText(/Vendas \(/);

    expect(screen.getByRole('link', { name: /Nova Venda/ })).toBeVisible();
    const menu = screen.getByRole('button', { name: /^Exportar$/ });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Exportar CSV' })).not.toBeInTheDocument();

    await userEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Exportar itens' })).toBeVisible();

    await userEvent.keyboard('{Escape}');
    expect(menu).toHaveAttribute('aria-expanded', 'false');
  });

  test('no desktop as exportações ficam à vista, sem menu', async () => {
    server.use(http.get(`${API_URL}/sales`, () => HttpResponse.json(saleList)));
    setViewport(1280);
    renderWithProviders(<SaleListPage />);
    await screen.findByText(/Vendas \(/);

    expect(screen.queryByRole('button', { name: /^Exportar$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Exportar itens' })).toBeVisible();
    expect(within(screen.getByRole('link', { name: /Nova Venda/ }).parentElement as HTMLElement).getAllByRole('button')).toHaveLength(2);
  });
});
