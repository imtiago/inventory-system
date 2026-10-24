import { describe, expect, test } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { DashboardPage } from '../DashboardPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import fixture from '@/test/fixtures/dashboard/dashboard.json';

function serve(data: Record<string, unknown>) {
  server.use(http.get(`${API_URL}/dashboard`, () => HttpResponse.json({ data })));
}

describe('DashboardPage', () => {
  test('ADMIN vê todas as seções com valores formatados', async () => {
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByRole('region', { name: 'Vendas' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Contas a receber' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Contas a pagar' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Estoque' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Compras' })).toBeInTheDocument();

    const sales = screen.getByRole('region', { name: 'Vendas' });
    expect(within(sales).getByTestId('sales-today')).toHaveTextContent(/412,90/);
    expect(within(sales).getByTestId('sales-today')).toHaveTextContent('3 vendas');
    expect(within(sales).getByTestId('sales-month')).toHaveTextContent(/8\.734,50/);
    expect(within(sales).getByText('Camiseta Básica — Azul M')).toBeInTheDocument();

    const rec = screen.getByRole('region', { name: 'Contas a receber' });
    expect(within(rec).getByTestId('receivables-open')).toHaveTextContent(/5\.230,75/);
    expect(within(rec).getByTestId('receivables-overdue')).toHaveTextContent(/640,00/);
    expect(within(rec).getByTestId('receivables-due7')).toHaveTextContent(/1\.180,50/);

    const stock = screen.getByRole('region', { name: 'Estoque' });
    expect(within(stock).getByText('Calça Jeans — 42')).toBeInTheDocument();
    expect(within(stock).getByText(/L2310-A/)).toBeInTheDocument();
    expect(within(stock).getByText(/05\/11\/2026/)).toBeInTheDocument();

    const purchases = screen.getByRole('region', { name: 'Compras' });
    expect(purchases).toHaveTextContent(/4\.520,30/);
  });

  test('ESTOQUISTA vê só estoque e compras', async () => {
    const { sales: _s, receivables: _r, payables: _p, ...rest } = fixture.data;
    void _s; void _r; void _p;
    serve(rest);
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByRole('region', { name: 'Estoque' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Compras' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Vendas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Contas a receber' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Contas a pagar' })).not.toBeInTheDocument();
  });

  test('VENDEDOR vê só vendas e estoque', async () => {
    const { payables: _p, receivables: _r, purchases: _c, ...rest } = fixture.data;
    void _p; void _r; void _c;
    serve(rest);
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByRole('region', { name: 'Vendas' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Compras' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Contas a pagar' })).not.toBeInTheDocument();
  });

  test('gráfico tem 7 barras com rótulos acessíveis, incluindo dias com zero', async () => {
    renderWithProviders(<DashboardPage />);

    const chart = await screen.findByRole('img', { name: /vendas dos últimos 7 dias/i });
    const bars = within(chart).getAllByTestId('sales-bar');
    expect(bars).toHaveLength(7);
    expect(bars[1]).toHaveAttribute('aria-label', expect.stringMatching(/^18\/10: R\$\s0,00 \(0 vendas\)$/));
    expect(bars[5]).toHaveAttribute('aria-label', expect.stringMatching(/^22\/10: R\$\s1\.310,25 \(7 vendas\)$/));
    // zero bar keeps a visible baseline; the max bar is full height
    expect(bars[1].getAttribute('style')).toMatch(/height:\s*[1-9]/);
    expect(bars[5].getAttribute('style')).toMatch(/height:\s*100%/);
    expect(within(chart).getByText('23/10')).toBeInTheDocument();

    const table = screen.getByRole('table', { name: /vendas por dia/i });
    expect(within(table).getAllByRole('row')).toHaveLength(8);
  });

  test('números linkam para listas filtradas', async () => {
    renderWithProviders(<DashboardPage />);
    await screen.findByRole('region', { name: 'Vendas' });

    const rec = screen.getByRole('region', { name: 'Contas a receber' });
    expect(within(rec).getByRole('link', { name: /em aberto/i })).toHaveAttribute('href', '/receivables');
    expect(within(rec).getByRole('link', { name: /vencid/i })).toHaveAttribute('href', '/receivables?status=OVERDUE');
    expect(within(rec).getByRole('link', { name: /7 dias/i })).toHaveAttribute('href', '/receivables?dueFrom=2026-10-23&dueTo=2026-10-30');

    const pay = screen.getByRole('region', { name: 'Contas a pagar' });
    expect(within(pay).getByRole('link', { name: /vencid/i })).toHaveAttribute('href', '/payables?status=OVERDUE');
    expect(within(pay).getByRole('link', { name: /7 dias/i })).toHaveAttribute('href', '/payables?dueFrom=2026-10-23&dueTo=2026-10-30');
    expect(within(pay).getByRole('link', { name: /em aberto/i })).toHaveAttribute('href', '/payables');

    expect(within(screen.getByRole('region', { name: 'Compras' })).getByRole('link')).toHaveAttribute('href', '/purchases');
    const stock = screen.getByRole('region', { name: 'Estoque' });
    expect(within(stock).getByRole('link', { name: /Calça Jeans/ })).toHaveAttribute('href', '/inventory');
    expect(within(stock).getByRole('link', { name: /Creme Hidratante/ })).toHaveAttribute('href', '/inventory');
  });

  test('erro mostra mensagem e botão de tentar novamente', async () => {
    let calls = 0;
    server.use(
      http.get(`${API_URL}/dashboard`, () => {
        calls += 1;
        return calls === 1 ? HttpResponse.json({ message: 'boom' }, { status: 500 }) : HttpResponse.json(fixture);
      }),
    );
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('region', { name: 'Vendas' })).toBeInTheDocument();
  });

  test('mostra estado de carregamento', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByRole('status')).toHaveTextContent(/carregando/i);
  });
});
