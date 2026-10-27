import { afterEach, describe, expect, test } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { SaleCancelRequestsPage } from '../SaleCancelRequestsPage';
import { createTestQueryClient } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import cancelRequests from '@/test/fixtures/sales/cancelRequests.json';
import { resetViewport, setViewport } from '@/test/viewport';

afterEach(() => resetViewport());

function renderPage() {
  const queryClient = createTestQueryClient();
  const invalidated: unknown[] = [];
  const original = queryClient.invalidateQueries.bind(queryClient);
  queryClient.invalidateQueries = ((filters: { queryKey?: unknown }) => {
    invalidated.push(filters?.queryKey);
    return original(filters as never);
  }) as typeof queryClient.invalidateQueries;
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SaleCancelRequestsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { invalidated };
}

const first = cancelRequests.data[0];

describe('SaleCancelRequestsPage', () => {
  test('lista os pedidos pendentes com cliente, valor, motivo e quem pediu', async () => {
    renderPage();

    expect(await screen.findByText('Maria Oliveira')).toBeInTheDocument();
    expect(screen.getByText('Carlos Souza')).toBeInTheDocument();
    expect(screen.getByText('Cliente desistiu da compra')).toBeInTheDocument();
    expect(screen.getAllByText('João Vendedor').length).toBe(2);
    expect(screen.getAllByText(/159,70/).length).toBeGreaterThan(0);
  });

  test('aprovar pede confirmação, envia Idempotency-Key e invalida os módulos afetados', async () => {
    let called = 0;
    let key: string | null = null;
    server.use(
      http.post(`${API_URL}/sales/cancel-requests/:id/approve`, ({ request, params }) => {
        called++;
        key = request.headers.get('Idempotency-Key');
        expect(params.id).toBe(first.id);
        return HttpResponse.json({ data: { ...first, status: 'APPROVED' } });
      }),
    );
    const { invalidated } = renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Aprovar pedido de Maria Oliveira/ }));
    expect(called).toBe(0);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /Aprovar e cancelar/ }));

    await waitFor(() => expect(called).toBe(1));
    expect(key).toBeTruthy();
    await waitFor(() => {
      const keys = invalidated.map((k) => (k as string[])[0]);
      expect(keys).toEqual(expect.arrayContaining(['sales', 'receivables', 'dashboard', 'inventory', 'cancel-requests']));
    });
  });

  test('409 ao aprovar mostra a mensagem da API', async () => {
    server.use(
      http.post(`${API_URL}/sales/cancel-requests/:id/approve`, () =>
        HttpResponse.json({ message: 'Venda com pagamentos registrados não pode ser cancelada.', code: 'SALE_HAS_PAYMENTS' }, { status: 409 }),
      ),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Aprovar pedido de Maria Oliveira/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Aprovar e cancelar/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Venda com pagamentos registrados não pode ser cancelada.');
  });

  test('recusar exige motivo (mín. 3) e envia o motivo', async () => {
    let body: unknown = null;
    server.use(
      http.post(`${API_URL}/sales/cancel-requests/:id/reject`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { ...first, status: 'REJECTED' } });
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Recusar pedido de Maria Oliveira/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Motivo'), 'ab');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar recusa' }));
    expect(await within(dialog).findByText(/3 a 200 caracteres/)).toBeInTheDocument();
    expect(body).toBeNull();

    await userEvent.type(within(dialog).getByLabelText('Motivo'), 'c');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar recusa' }));
    await waitFor(() => expect(body).toEqual({ reason: 'abc' }));
  });

  test('sem pedidos mostra o estado vazio', async () => {
    server.use(http.get(`${API_URL}/sales/cancel-requests`, () => HttpResponse.json({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } })));
    renderPage();

    expect(await screen.findByText('Nenhum pedido de cancelamento')).toBeInTheDocument();
  });

  test('no celular vira cartões', async () => {
    setViewport(375, { pointer: 'coarse' });
    renderPage();

    await screen.findByText('Maria Oliveira');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // As ações ficam no menu "Mais ações" do cartão.
    await userEvent.click(screen.getAllByRole('button', { name: /Mais ações/ })[1]);
    expect(await screen.findByRole('button', { name: /Aprovar pedido de Carlos Souza/ })).toBeInTheDocument();
  });
});
