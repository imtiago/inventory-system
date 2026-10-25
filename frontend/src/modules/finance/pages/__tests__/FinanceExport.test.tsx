import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { ReceivableListPage } from '@/modules/receivables/pages/ReceivableListPage';
import { PayableListPage } from '@/modules/payables/pages/PayableListPage';
import { SaleListPage } from '@/modules/sales/pages/SaleListPage';
import { InventoryListPage } from '@/modules/inventory/pages/InventoryListPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { loginAs } from '@/test/auth';
import { API_URL } from '@/test/handlers/inventory';
import { todayInBusinessTz } from '@/shared/utils/businessDate';
import receivableList from '@/test/fixtures/finance/receivableList.json';

const createObjectURL = vi.fn(() => 'blob:fake');
const revokeObjectURL = vi.fn();
let clicked: string[] = [];

beforeEach(() => {
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  clicked = [];
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this.download);
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function trackCsv(path: string, disposition?: string) {
  const urls: URL[] = [];
  server.use(
    http.get(`${API_URL}${path}`, ({ request }) => {
      urls.push(new URL(request.url));
      return new HttpResponse('a;b\r\n', { headers: { 'Content-Type': 'text/csv', ...(disposition ? { 'Content-Disposition': disposition } : {}) } });
    }),
  );
  return urls;
}

describe('openOnly (Somente com saldo)', () => {
  test('caixa envia openOnly=true (só quando marcada), zera a página e é lida da URL', async () => {
    const urls: URL[] = [];
    server.use(http.get(`${API_URL}/receivables`, ({ request }) => { urls.push(new URL(request.url)); return HttpResponse.json({ ...receivableList, pagination: { page: 2, limit: 10, total: 25, totalPages: 3 } }); }));
    renderWithProviders(<ReceivableListPage />, { route: '/receivables?page=2' });
    await screen.findByText('Carlos Souza');
    expect(urls[0].searchParams.get('openOnly')).toBeNull();

    await userEvent.click(screen.getByLabelText('Somente com saldo'));
    await waitFor(() => {
      const last = urls[urls.length - 1];
      expect(last.searchParams.get('openOnly')).toBe('true');
      expect(last.searchParams.get('page')).toBe('1');
    });

    await userEvent.click(screen.getByLabelText('Somente com saldo'));
    await waitFor(() => expect(urls[urls.length - 1].searchParams.get('openOnly')).toBeNull());
  });

  test('openOnly=true na URL marca a caixa e vai na requisição (pagar)', async () => {
    const urls: URL[] = [];
    server.use(http.get(`${API_URL}/payables`, ({ request }) => { urls.push(new URL(request.url)); return HttpResponse.json(receivableList); }));
    renderWithProviders(<PayableListPage />, { route: '/payables?openOnly=true' });
    await waitFor(() => expect(urls.length).toBeGreaterThan(0));
    expect(urls[0].searchParams.get('openOnly')).toBe('true');
    expect(screen.getByLabelText('Somente com saldo')).toBeChecked();
  });
});

describe('Exportar CSV', () => {
  test('contas a receber: envia os filtros da tela e baixa o arquivo com o nome do cabeçalho', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const urls = trackCsv('/reports/receivables.csv', 'attachment; filename="contas-a-receber-2026-10-24.csv"');
    server.use(http.get(`${API_URL}/receivables`, () => HttpResponse.json(receivableList)));
    renderWithProviders(<ReceivableListPage />, { route: '/receivables?status=OVERDUE&customerId=c-1&dueFrom=2026-10-01&dueTo=2026-10-31&openOnly=true&page=2' });
    await screen.findByText('Carlos Souza');

    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await waitFor(() => expect(clicked).toEqual(['contas-a-receber-2026-10-24.csv']));
    const q = urls[0].searchParams;
    expect(q.get('status')).toBe('OVERDUE');
    expect(q.get('customerId')).toBe('c-1');
    expect(q.get('dueFrom')).toBe('2026-10-01');
    expect(q.get('dueTo')).toBe('2026-10-31');
    expect(q.get('openOnly')).toBe('true');
    expect(q.get('page')).toBeNull();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    // Revogação adiada em 60 s (Safari/iOS lê o arquivo depois do clique).
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(59_000);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_500);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  test('sem Content-Disposition legível usa o nome padrão', async () => {
    trackCsv('/reports/payables.csv');
    renderWithProviders(<PayableListPage />, { route: '/payables' });
    await screen.findByText(/Contas a pagar \(\d+\)/);
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await waitFor(() => expect(clicked).toEqual([`contas-a-pagar-${todayInBusinessTz()}.csv`]));
  });

  test('erro 422 (blob JSON) mostra a mensagem da API uma vez e reabilita o botão', async () => {
    server.use(
      http.get(`${API_URL}/receivables`, () => HttpResponse.json(receivableList)),
      http.get(`${API_URL}/reports/receivables.csv`, () => HttpResponse.json({ code: 'EXPORT_TOO_LARGE', message: 'Muitas linhas, refine os filtros.' }, { status: 422 })),
    );
    renderWithProviders(<ReceivableListPage />, { route: '/receivables' });
    await screen.findByText('Carlos Souza');
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(await screen.findAllByText('Muitas linhas, refine os filtros.')).toHaveLength(1);
    expect(clicked).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeEnabled();
  });

  test('botão fica desabilitado com texto de progresso durante o download', async () => {
    let release!: () => void;
    server.use(
      http.get(`${API_URL}/receivables`, () => HttpResponse.json(receivableList)),
      http.get(`${API_URL}/reports/receivables.csv`, async () => {
        await new Promise<void>((r) => { release = r; });
        return new HttpResponse('a', { headers: { 'Content-Type': 'text/csv' } });
      }),
    );
    renderWithProviders(<ReceivableListPage />, { route: '/receivables' });
    await screen.findByText('Carlos Souza');
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(await screen.findByRole('button', { name: /Exportando/ })).toBeDisabled();
    await waitFor(() => expect(release).toBeTypeOf('function'));
    release();
    await screen.findByRole('button', { name: 'Exportar CSV' });
  });

  test('vendas: período padrão (mês atual) e Exportar itens usam from/to', async () => {
    const sales = trackCsv('/reports/sales.csv');
    const items = trackCsv('/reports/sale-items.csv');
    renderWithProviders(<SaleListPage />);
    const today = todayInBusinessTz();
    const monthStart = `${today.slice(0, 8)}01`;
    expect(screen.getByLabelText('De')).toHaveValue(monthStart);
    expect(screen.getByLabelText('Até')).toHaveValue(today);

    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await waitFor(() => expect(sales).toHaveLength(1));
    expect(sales[0].searchParams.get('from')).toBe(monthStart);
    expect(sales[0].searchParams.get('to')).toBe(today);

    await userEvent.click(screen.getByRole('button', { name: 'Exportar itens' }));
    await waitFor(() => expect(items).toHaveLength(1));
    expect(items[0].searchParams.get('from')).toBe(monthStart);
    expect(clicked).toEqual([`vendas-${today}.csv`, `itens-vendidos-${today}.csv`]);
  });

  test('vendas: exportação envia status escolhido e período editado; itens não enviam status', async () => {
    const sales = trackCsv('/reports/sales.csv');
    const items = trackCsv('/reports/sale-items.csv');
    renderWithProviders(<SaleListPage />);

    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-02-01' } });
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-02-28' } });
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'CANCELED');
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await waitFor(() => expect(sales).toHaveLength(1));
    expect(Object.fromEntries(sales[0].searchParams)).toEqual({ from: '2026-02-01', to: '2026-02-28', status: 'CANCELED' });

    await userEvent.click(screen.getByRole('button', { name: 'Exportar itens' }));
    await waitFor(() => expect(items).toHaveLength(1));
    expect(Object.fromEntries(items[0].searchParams)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  test('vendas: período acima de 366 dias mostra o aviso, desabilita os botões e não envia requisição', async () => {
    const sales = trackCsv('/reports/sales.csv');
    renderWithProviders(<SaleListPage />);
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2025-01-01' } });
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-01-01' } }); // 366 dias: ok
    expect(screen.queryByText('O período deve ter no máximo 366 dias.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-01-02' } }); // 367 dias
    expect(screen.getByText('O período deve ter no máximo 366 dias.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Exportar itens' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(sales).toHaveLength(0);
  });

  test('erro 400 com errors[] mostra a primeira mensagem de campo em vez da genérica', async () => {
    server.use(
      http.get(`${API_URL}/reports/sales.csv`, () =>
        HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'Dados inválidos.', errors: [{ field: 'to', message: 'Data final inválida.' }, { field: 'from', message: 'outra' }] }, { status: 400 }),
      ),
    );
    renderWithProviders(<SaleListPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(await screen.findByText('Data final inválida.')).toBeInTheDocument();
    expect(screen.queryByText('Dados inválidos.')).toBeNull();
  });

  test('o erro some quando os filtros mudam', async () => {
    server.use(http.get(`${API_URL}/reports/sales.csv`, () => HttpResponse.json({ code: 'EXPORT_TOO_LARGE', message: 'Muitas linhas.' }, { status: 422 })));
    renderWithProviders(<SaleListPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(await screen.findByText('Muitas linhas.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-01-01' } });
    await waitFor(() => expect(screen.queryByText('Muitas linhas.')).toBeNull());
  });

  test('estoque exporta sem filtros', async () => {
    const urls = trackCsv('/reports/stock.csv');
    renderWithProviders(<InventoryListPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await waitFor(() => expect(urls).toHaveLength(1));
    expect(clicked).toEqual([`estoque-${todayInBusinessTz()}.csv`]);
  });

  test('botões por permissão', async () => {
    loginAs('ESTOQUISTA');
    const { unmount } = renderWithProviders(<SaleListPage />);
    expect(screen.queryByRole('button', { name: 'Exportar CSV' })).toBeNull();
    unmount();
    renderWithProviders(<InventoryListPage />);
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeInTheDocument();
  });

  test('vendedor exporta vendas e contas a receber, mas não contas a pagar', async () => {
    loginAs('VENDEDOR');
    const a = renderWithProviders(<ReceivableListPage />, { route: '/receivables' });
    await screen.findByText('Carlos Souza');
    expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeInTheDocument();
    a.unmount();
    renderWithProviders(<PayableListPage />, { route: '/payables' });
    await screen.findByText(/Contas a pagar \(\d+\)/);
    expect(screen.queryByRole('button', { name: 'Exportar CSV' })).toBeNull();
  });
});
