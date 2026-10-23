import { describe, expect, test } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { PayableListPage } from '../PayableListPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import payableList from '@/test/fixtures/finance/payableList.json';

describe('PayableListPage', () => {
  test('lista de contas a pagar com fornecedor, link para o pedido, filtros e resumo', async () => {
    const urls: URL[] = [];
    server.use(
      http.get(`${API_URL}/payables`, ({ request }) => {
        urls.push(new URL(request.url));
        return HttpResponse.json(payableList);
      }),
      http.get(`${API_URL}/suppliers`, () =>
        HttpResponse.json({ data: [{ id: 's-1', name: 'Atacado Central ME', document: '12345678000190', documentType: 'CNPJ' }], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } }),
      ),
    );
    renderWithProviders(<PayableListPage />, { route: '/payables' });

    const first = payableList.data[0];
    expect(await screen.findAllByText('Distribuidora Boa Vista Ltda')).not.toHaveLength(0);
    expect(screen.getByText('Fornecedor', { selector: 'th, th *' })).toBeInTheDocument();
    const row = screen.getAllByRole('row').find((r) => within(r).queryByText('Pedido PC000012'))!;
    expect(within(row).getByRole('link', { name: 'Pedido PC000012' })).toHaveAttribute('href', `/purchases/${first.originId}`);
    expect(within(row).getByRole('link', { name: 'Ver conta' })).toHaveAttribute('href', `/payables/${first.id}`);
    expect(within(row).getByText('Vencida')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /Contas a pagar/ })).toBeInTheDocument();
    expect(screen.getByTestId('summary-open')).toHaveTextContent('78,24');
    expect(screen.getByTestId('summary-overdue')).toHaveTextContent('53,23');
    expect(screen.getByTestId('summary-paid')).toHaveTextContent('Pago');
    expect(screen.getByTestId('summary-paid')).toHaveTextContent('93,23');
    expect(screen.queryByText('Recebido')).toBeNull();

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'OVERDUE');
    fireEvent.change(screen.getByLabelText('Vencimento de'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Vencimento até'), { target: { value: '2026-10-31' } });
    await userEvent.type(screen.getByPlaceholderText('Todos os fornecedores'), 'Ata');
    await userEvent.click(await screen.findByText('Atacado Central ME', { selector: '[role="option"] *, [role="option"]' }));

    await waitFor(() => {
      const last = urls[urls.length - 1];
      expect(last.searchParams.get('status')).toBe('OVERDUE');
      expect(last.searchParams.get('supplierId')).toBe('s-1');
      expect(last.searchParams.get('dueFrom')).toBe('2026-10-01');
      expect(last.searchParams.get('dueTo')).toBe('2026-10-31');
      expect(last.searchParams.get('customerId')).toBeNull();
    });
  });

  test('erro de carregamento mostra mensagem de contas a pagar', async () => {
    server.use(http.get(`${API_URL}/payables`, () => HttpResponse.json({ error: 'x' }, { status: 500 })));
    renderWithProviders(<PayableListPage />, { route: '/payables' });
    expect(await screen.findByText(/Não foi possível carregar as contas a pagar/)).toBeInTheDocument();
  });
});
