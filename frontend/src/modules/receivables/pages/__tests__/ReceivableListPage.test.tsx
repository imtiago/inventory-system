import { describe, expect, test } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { ReceivableListPage } from '../ReceivableListPage';
import { Sidebar } from '@/components/Sidebar';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import receivableList from '@/test/fixtures/finance/receivableList.json';

describe('ReceivableListPage', () => {
  test('lista mostra cliente, origem (link para a venda), totais, próximo vencimento e status PT', async () => {
    renderWithProviders(<ReceivableListPage />, { route: '/receivables' });

    const first = receivableList.data[0];
    const row = (await screen.findByText('Carlos Souza')).closest('tr')!;

    const rows = screen.getAllByRole('row');
    const mariaRow = rows.find((r) => within(r).queryByText(`Venda #${first.originId.slice(0, 8).toUpperCase()}`))!;
    expect(mariaRow).toBeTruthy();
    const link = within(mariaRow).getByRole('link', { name: `Venda #${first.originId.slice(0, 8).toUpperCase()}` });
    expect(link).toHaveAttribute('href', `/sales/${first.originId}`);
    expect(within(mariaRow).getByText('Maria Oliveira')).toBeInTheDocument();
    expect(within(mariaRow).getByText(/159,70/)).toBeInTheDocument();
    expect(within(mariaRow).getByText(/53,23/)).toBeInTheDocument();
    expect(within(mariaRow).getByText(/106,47/)).toBeInTheDocument();
    expect(within(mariaRow).getByText('21/10/2026')).toBeInTheDocument();
    expect(within(mariaRow).getByText('Vencida')).toBeInTheDocument();
    expect(within(mariaRow).getByRole('link', { name: 'Ver conta' })).toHaveAttribute('href', `/receivables/${first.id}`);

    expect(within(row).getByText('A vencer')).toBeInTheDocument();
    const paidRow = screen.getAllByRole('row').find((r) => within(r).queryByText('Paga'))!;
    expect(within(paidRow).getByText('—')).toBeInTheDocument();
  });

  test('cards de resumo mostram A vencer, Vencido e Recebido', async () => {
    renderWithProviders(<ReceivableListPage />, { route: '/receivables' });

    await screen.findByText('Carlos Souza');
    const open = screen.getByTestId('summary-open');
    expect(open).toHaveTextContent('A vencer');
    expect(open).toHaveTextContent('78,24');
    expect(screen.getByTestId('summary-overdue')).toHaveTextContent('Vencido');
    expect(screen.getByTestId('summary-overdue')).toHaveTextContent('53,23');
    expect(screen.getByTestId('summary-received')).toHaveTextContent('Recebido');
    expect(screen.getByTestId('summary-received')).toHaveTextContent('93,23');
  });

  test('filtros enviam status/customerId/dueFrom/dueTo na query', async () => {
    const urls: URL[] = [];
    server.use(
      http.get(`${API_URL}/receivables`, ({ request }) => {
        urls.push(new URL(request.url));
        return HttpResponse.json(receivableList);
      }),
      http.get(`${API_URL}/customers`, () =>
        HttpResponse.json({ data: [{ id: 'c-1', name: 'Maria Oliveira', code: 'CLI-1' }], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } }),
      ),
    );
    renderWithProviders(<ReceivableListPage />, { route: '/receivables' });
    await screen.findByText('Carlos Souza');
    expect(urls[0].searchParams.get('status')).toBeNull();

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'OVERDUE');
    fireEvent.change(screen.getByLabelText('Vencimento de'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Vencimento até'), { target: { value: '2026-10-31' } });
    await userEvent.type(screen.getByPlaceholderText('Todos os clientes'), 'Mar');
    await userEvent.click(await screen.findByText('Maria Oliveira', { selector: '[role="option"] *, [role="option"]' }));

    await waitFor(() => {
      const last = urls[urls.length - 1];
      expect(last.searchParams.get('status')).toBe('OVERDUE');
      expect(last.searchParams.get('customerId')).toBe('c-1');
      expect(last.searchParams.get('dueFrom')).toBe('2026-10-01');
      expect(last.searchParams.get('dueTo')).toBe('2026-10-31');
      expect(last.searchParams.get('page')).toBe('1');
    });
    expect(screen.getByText('Inclui títulos com alguma parcela no período.')).toBeInTheDocument();
  });

  test('filtros iniciais vêm da query string da URL', async () => {
    const urls: URL[] = [];
    server.use(
      http.get(`${API_URL}/receivables`, ({ request }) => {
        urls.push(new URL(request.url));
        return HttpResponse.json(receivableList);
      }),
    );
    renderWithProviders(<ReceivableListPage />, { route: '/receivables?status=PAID&dueFrom=2026-10-01' });
    await screen.findByText('Carlos Souza');
    expect(urls[0].searchParams.get('status')).toBe('PAID');
    expect(urls[0].searchParams.get('dueFrom')).toBe('2026-10-01');
    expect(screen.getByLabelText('Status')).toHaveValue('PAID');
    expect(screen.getByLabelText('Vencimento de')).toHaveValue('2026-10-01');
  });

  test('erro de carregamento mostra mensagem', async () => {
    server.use(http.get(`${API_URL}/receivables`, () => HttpResponse.json({ error: 'x' }, { status: 500 })));
    renderWithProviders(<ReceivableListPage />, { route: '/receivables' });
    expect(await screen.findByText(/Não foi possível carregar as contas a receber/)).toBeInTheDocument();
  });
});

describe('ReceivableListPage filtros (revisão)', () => {
  function track(list: unknown = receivableList) {
    const urls: URL[] = [];
    server.use(
      http.get(`${API_URL}/receivables`, ({ request }) => {
        urls.push(new URL(request.url));
        return HttpResponse.json(list as object);
      }),
    );
    return urls;
  }

  test('bookmark com customerId mostra o nome do cliente e permite limpar', async () => {
    server.use(http.get(`${API_URL}/customers/c-9`, () => HttpResponse.json({ id: 'c-9', name: 'Fulana de Tal', code: 'CLI-9' })));
    const urls = track();
    renderWithProviders(<ReceivableListPage />, { route: '/receivables?customerId=c-9' });
    expect(await screen.findByDisplayValue('Fulana de Tal')).toBeInTheDocument();
    expect(urls[0].searchParams.get('customerId')).toBe('c-9');

    await userEvent.click(screen.getByRole('button', { name: /limpar/i }));
    await waitFor(() => expect(urls[urls.length - 1].searchParams.get('customerId')).toBeNull());
  });

  test('dueFrom maior que dueTo mostra mensagem e não envia a requisição', async () => {
    const urls = track();
    renderWithProviders(<ReceivableListPage />, { route: '/receivables?dueFrom=2026-10-31&dueTo=2026-10-01' });
    expect(await screen.findByText('A data inicial deve ser anterior ou igual à final.')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(urls).toHaveLength(0);
  });

  test('página acima do total vai para a última página', async () => {
    const urls = track({ ...receivableList, pagination: { page: 5, limit: 10, total: 25, totalPages: 3 } });
    renderWithProviders(<ReceivableListPage />, { route: '/receivables?page=5' });
    await waitFor(() => expect(urls[urls.length - 1].searchParams.get('page')).toBe('3'));
  });

  test('mudar filtro a partir de ?page=2 volta para a página 1', async () => {
    const urls = track({ ...receivableList, pagination: { page: 2, limit: 10, total: 25, totalPages: 3 } });
    renderWithProviders(<ReceivableListPage />, { route: '/receivables?page=2' });
    await screen.findByText('Carlos Souza');
    expect(urls[0].searchParams.get('page')).toBe('2');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'PAID');
    await waitFor(() => {
      const last = urls[urls.length - 1];
      expect(last.searchParams.get('status')).toBe('PAID');
      expect(last.searchParams.get('page')).toBe('1');
    });
  });

  test('filtros vazios são omitidos da requisição', async () => {
    const urls = track();
    renderWithProviders(<ReceivableListPage />, { route: '/receivables?status=&customerId=&dueFrom=&dueTo=' });
    await screen.findByText('Carlos Souza');
    for (const key of ['status', 'customerId', 'dueFrom', 'dueTo']) expect(urls[0].searchParams.has(key)).toBe(false);
  });
});

describe('Sidebar', () => {
  test('menu tem Financeiro → Contas a receber', () => {
    renderWithProviders(<Sidebar />);
    expect(screen.getByText('Financeiro')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contas a receber' })).toHaveAttribute('href', '/receivables');
  });
});
