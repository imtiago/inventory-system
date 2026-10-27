import { describe, expect, test } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { ProfitReportPage } from '../ProfitReportPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { setViewport } from '@/test/viewport';
import { API_URL } from '@/test/handlers/inventory';
import fixture from '@/test/fixtures/reports/profit.json';

const calls: URLSearchParams[] = [];

function serveProfit(body: Record<string, unknown> = fixture) {
  calls.length = 0;
  server.use(
    http.get(`${API_URL}/reports/profit`, ({ request }) => {
      calls.push(new URL(request.url).searchParams);
      return HttpResponse.json(body);
    }),
  );
}

describe('ProfitReportPage', () => {
  test('mostra linhas, linha de totais e aviso de itens sem custo registrado', async () => {
    serveProfit();
    renderWithProviders(<ProfitReportPage />);

    expect(await screen.findByText('23/10/2026')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getAllByText(/1\.250,50/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/34,00%/).length).toBeGreaterThan(0);
    expect(screen.getByRole('status')).toHaveTextContent('2 itens sem custo registrado');
    expect(calls[0].get('view')).toBe('period');
    expect(calls[0].get('from')).toMatch(/^\d{4}-\d{2}-01$/);
  });

  test('sem itens sem custo: não mostra o aviso', async () => {
    const row = { ...fixture.data.rows[0], itemsWithoutCost: 0, marginPercent: null };
    serveProfit({ data: { rows: [row], totals: { ...row, key: 'total', label: 'Total' } } });
    renderWithProviders(<ProfitReportPage />);

    expect(await screen.findByText('23/10/2026')).toBeInTheDocument();
    expect(screen.queryByText(/sem custo registrado/)).not.toBeInTheDocument();
  });

  test('período sem vendas: estado vazio e nenhuma linha de totais', async () => {
    const zero = { ...fixture.data.totals, revenue: 0, cost: 0, estimatedExpenses: 0, profit: 0, itemsWithoutCost: 0, marginPercent: null };
    serveProfit({ data: { rows: [], totals: zero } });
    renderWithProviders(<ProfitReportPage />);

    expect(await screen.findByText('Nenhuma venda no período')).toBeInTheDocument();
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
  });

  test('troca de visão envia view e refaz a consulta', async () => {
    serveProfit();
    const user = userEvent.setup();
    renderWithProviders(<ProfitReportPage />);
    await screen.findByText('23/10/2026');

    for (const [label, view] of [['Venda', 'sale'], ['Produto', 'variant'], ['Categoria', 'category'], ['Período', 'period']] as const) {
      await user.click(screen.getByRole('button', { name: label }));
      await waitFor(() => expect(calls.at(-1)?.get('view')).toBe(view));
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
    }
  });

  test('filtros de período e vendedor vão na consulta', async () => {
    serveProfit();
    const user = userEvent.setup();
    renderWithProviders(<ProfitReportPage />);
    await screen.findByText('23/10/2026');

    const from = screen.getByLabelText('De');
    await user.clear(from);
    await user.type(from, '2026-09-01');
    await waitFor(() => expect(calls.at(-1)?.get('from')).toBe('2026-09-01'));

    const seller = await screen.findByLabelText('Vendedor');
    await within(seller).findByRole('option', { name: /João Vendas/ });
    await user.selectOptions(seller, within(seller).getByRole('option', { name: /João Vendas/ }));
    await waitFor(() => expect(calls.at(-1)?.get('sellerId')).toBe('1b2e9f40-8c3d-4e7a-b6f1-0a9d8c7e6f54'));
  });

  test('tem botão de exportar CSV', async () => {
    serveProfit();
    renderWithProviders(<ProfitReportPage />);
    expect(await screen.findByRole('button', { name: 'Exportar CSV' })).toBeInTheDocument();
  });

  test('no celular vira cartões: rótulo, lucro e margem', async () => {
    setViewport(375);
    serveProfit();
    renderWithProviders(<ProfitReportPage />);

    const title = await screen.findByText('23/10/2026');
    const card = title.closest('li, article') ?? title.parentElement!.parentElement!;
    expect(card).toHaveTextContent(/425,20/);
    expect(card).toHaveTextContent(/34,00%/);
  });

  test('erro da consulta mostra mensagem', async () => {
    server.use(http.get(`${API_URL}/reports/profit`, () => HttpResponse.json({ error: { message: 'x' } }, { status: 500 })));
    renderWithProviders(<ProfitReportPage />);
    expect(await screen.findByText(/Não foi possível carregar o relatório/)).toBeInTheDocument();
  });
});
