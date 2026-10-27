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
    expect(within(stock).getByText('0 un.')).toBeInTheDocument();
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

  test('VENDEDOR vê vendas, contas a receber e estoque', async () => {
    const { payables: _p, purchases: _c, ...rest } = fixture.data;
    void _p; void _c;
    serve(rest);
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByRole('region', { name: 'Vendas' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Contas a receber' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Estoque' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Compras' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Contas a pagar' })).not.toBeInTheDocument();
  });

  test('lote sem número não mostra "lote"', async () => {
    const lot = { ...fixture.data.inventory.expiringLots.items[0], batchNumber: null };
    serve({
      ...fixture.data,
      inventory: { ...fixture.data.inventory, expiringLots: { count: 1, items: [lot] } },
    });
    renderWithProviders(<DashboardPage />);

    const stock = await screen.findByRole('region', { name: 'Estoque' });
    expect(within(stock).getByText(/vence em/)).toBeInTheDocument();
    expect(within(stock).queryByText(/\blote\b/i)).not.toBeInTheDocument();
  });

  test('gráfico tem 7 barras com rótulos acessíveis, incluindo dias com zero', async () => {
    renderWithProviders(<DashboardPage />);

    const chart = await screen.findByRole('group', { name: /vendas dos últimos 7 dias/i });
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
    expect(within(rec).getByRole('link', { name: /em aberto/i })).toHaveAttribute('href', '/receivables?openOnly=true');
    expect(within(rec).getByRole('link', { name: /vencid/i })).toHaveAttribute('href', '/receivables?status=OVERDUE');
    expect(within(rec).getByRole('link', { name: /7 dias/i })).toHaveAttribute('href', '/receivables?openOnly=true&dueFrom=2026-10-23&dueTo=2026-10-30');

    const pay = screen.getByRole('region', { name: 'Contas a pagar' });
    expect(within(pay).getByRole('link', { name: /vencid/i })).toHaveAttribute('href', '/payables?status=OVERDUE');
    expect(within(pay).getByRole('link', { name: /7 dias/i })).toHaveAttribute('href', '/payables?openOnly=true&dueFrom=2026-10-23&dueTo=2026-10-30');
    expect(within(pay).getByRole('link', { name: /em aberto/i })).toHaveAttribute('href', '/payables?openOnly=true');

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

  test('cartões financeiros não usam 3 colunas estreitas e valores não transbordam', async () => {
    renderWithProviders(<DashboardPage />);
    const rec = await screen.findByRole('region', { name: 'Contas a receber' });
    const grid = within(rec).getByTestId('receivables-open').parentElement as HTMLElement;
    expect(grid.className).toMatch(/lg:grid-cols-1/);
    expect(grid.className).toMatch(/2xl:grid-cols-3/);
    const value = within(within(rec).getByTestId('receivables-open')).getByText(/5\.230,75/);
    expect(value).toHaveClass('tabular-nums', 'text-foreground');
    expect(within(rec).getByTestId('receivables-open')).toHaveClass('min-w-0');
  });

  test('ADMIN vê os cartões de lucro e margem do mês', async () => {
    renderWithProviders(<DashboardPage />);
    const card = await screen.findByRole('region', { name: 'Lucro do mês' });
    expect(within(card).getByTestId('profit-month')).toHaveTextContent(/2\.410,80/);
    expect(within(card).getByTestId('profit-margin')).toHaveTextContent(/27,60%/);
    expect(within(card).getByRole('link', { name: /Ver relatório/ })).toHaveAttribute('href', '/reports/profit');
  });

  test('lucro do mês: avisa quantas vendas estão sem custo registrado, e some quando zero', async () => {
    serve({ ...fixture.data, profit: { month: { ...fixture.data.profit.month, itemsWithoutCost: 3 } } });
    const { unmount } = renderWithProviders(<DashboardPage />);
    const card = await screen.findByRole('region', { name: 'Lucro do mês' });
    expect(within(card).getByRole('status')).toHaveTextContent('3 vendas sem custo registrado');
    unmount();

    serve({ ...fixture.data, profit: { month: { ...fixture.data.profit.month, itemsWithoutCost: 1 } } });
    const second = renderWithProviders(<DashboardPage />);
    expect(within(await screen.findByRole('region', { name: 'Lucro do mês' })).getByRole('status')).toHaveTextContent('1 venda sem custo registrado');
    second.unmount();

    serve(fixture.data);
    renderWithProviders(<DashboardPage />);
    const zero = await screen.findByRole('region', { name: 'Lucro do mês' });
    expect(within(zero).queryByText(/sem custo registrado/)).not.toBeInTheDocument();
  });

  test('VENDEDOR não vê cartões de lucro', async () => {
    const { profit: _p, pricing: _q, payables: _y, purchases: _c, ...rest } = fixture.data;
    void _p; void _q; void _y; void _c;
    serve(rest);
    renderWithProviders(<DashboardPage />);
    expect(await screen.findByRole('region', { name: 'Vendas' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Lucro do mês' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('profit-margin')).not.toBeInTheDocument();
  });

  test('ADMIN vê o cartão "Preços para revisar" com o total e o link da lista', async () => {
    renderWithProviders(<DashboardPage />);

    const card = await screen.findByRole('region', { name: 'Preços para revisar' });
    expect(card).toHaveTextContent('3 preços');
    expect(within(card).getByRole('link', { name: /Revisar preços/ })).toHaveAttribute('href', '/catalog/price-reviews');
  });

  test('sem a seção pricing (não ADMIN) não há cartão', async () => {
    const { pricing: _p, ...rest } = fixture.data;
    void _p;
    serve(rest);
    renderWithProviders(<DashboardPage />);

    await screen.findByRole('region', { name: 'Vendas' });
    expect(screen.queryByRole('region', { name: 'Preços para revisar' })).not.toBeInTheDocument();
  });
});
