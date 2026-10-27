import { afterEach, describe, expect, test } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { createTestQueryClient, renderWithProviders } from '@/test/render';
import { resetViewport, setViewport } from '@/test/viewport';
import requests from '@/test/fixtures/credit/creditLimitRequests.json';

import { CreditRequestsPage } from '../CreditRequestsPage';

afterEach(() => resetViewport());

const first = requests.data[0];

function renderPage() {
  const queryClient = createTestQueryClient();
  const invalidated: string[] = [];
  const original = queryClient.invalidateQueries.bind(queryClient);
  queryClient.invalidateQueries = ((filters: { queryKey?: readonly unknown[] }) => {
    invalidated.push(String(filters?.queryKey?.[0]));
    return original(filters as never);
  }) as typeof queryClient.invalidateQueries;
  renderWithProviders(<CreditRequestsPage />, { queryClient });
  return { invalidated };
}

describe('CreditRequestsPage', () => {
  test('lista os pedidos pendentes com cliente, limite atual → pedido, motivo e quem pediu', async () => {
    renderPage();

    expect(await screen.findByText('Maria Oliveira')).toBeInTheDocument();
    expect(screen.getByText('Carlos Souza')).toBeInTheDocument();
    expect(screen.getByText(/enxoval completo/)).toBeInTheDocument();
    expect(screen.getAllByText('João Vendedor').length).toBe(2);
    expect(screen.getByText(/atual R\$ 800,00/)).toBeInTheDocument();
    expect(screen.getByText('R$ 1.500,00')).toBeInTheDocument();
  });

  test('aprovar abre o diálogo com o valor pedido, permite ajustar e envia Idempotency-Key', async () => {
    let body: unknown = null;
    let key: string | null = null;
    server.use(
      http.post(`${API_URL}/credit/limit-requests/:id/approve`, async ({ request, params }) => {
        key = request.headers.get('Idempotency-Key');
        body = await request.json();
        expect(params.id).toBe(first.id);
        return HttpResponse.json({ data: { ...first, status: 'APPROVED', approvedLimit: 1200 } });
      }),
    );
    const { invalidated } = renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Aprovar pedido de Maria Oliveira/ }));
    const dialog = await screen.findByRole('dialog');
    const limit = within(dialog).getByLabelText('Limite aprovado (R$)');
    expect(limit).toHaveValue('1.500,00');
    await userEvent.clear(limit);
    await userEvent.type(limit, '1200');
    await userEvent.type(within(dialog).getByLabelText(/Observação/), 'Valor menor por ora');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aprovar pedido' }));

    await waitFor(() => expect(body).toEqual({ approvedLimit: 1200, reason: 'Valor menor por ora' }));
    expect(key).toBeTruthy();
    await waitFor(() => expect(invalidated).toEqual(expect.arrayContaining(['credit', 'customers'])));
  });

  test('aprovar sem mexer no valor não manda approvedLimit', async () => {
    let body: unknown = null;
    server.use(
      http.post(`${API_URL}/credit/limit-requests/:id/approve`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { ...first, status: 'APPROVED', approvedLimit: 1500 } });
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Aprovar pedido de Maria Oliveira/ }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Aprovar pedido' }));

    await waitFor(() => expect(body).toEqual({}));
  });

  test('409 ao aprovar mostra a mensagem da API no diálogo', async () => {
    server.use(
      http.post(`${API_URL}/credit/limit-requests/:id/approve`, () =>
        HttpResponse.json({ message: 'Este pedido de aumento já foi decidido.', code: 'CREDIT_REQUEST_NOT_PENDING' }, { status: 409 }),
      ),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Aprovar pedido de Maria Oliveira/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aprovar pedido' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Este pedido de aumento já foi decidido.');
  });

  test('recusar exige motivo (mín. 3) e envia o motivo', async () => {
    let body: unknown = null;
    server.use(
      http.post(`${API_URL}/credit/limit-requests/:id/reject`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { ...first, status: 'REJECTED' } });
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Recusar pedido de Maria Oliveira/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Motivo'), 'ab');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar recusa' }));
    expect(await within(dialog).findByText(/3 a 300 caracteres/)).toBeInTheDocument();
    expect(body).toBeNull();

    await userEvent.type(within(dialog).getByLabelText('Motivo'), 'c');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar recusa' }));
    await waitFor(() => expect(body).toEqual({ reason: 'abc' }));
  });

  test('filtro de situação consulta a API; decididos mostram motivo, decisor e "automático"', async () => {
    const statuses: (string | null)[] = [];
    server.use(
      http.get(`${API_URL}/credit/limit-requests`, ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        statuses.push(status);
        if (status === 'PENDING') return HttpResponse.json(requests);
        return HttpResponse.json({
          data: [
            { ...first, status: 'APPROVED', autoApproved: true, approvedLimit: 1500, decidedAt: first.requestedAt, decisionReason: 'Aprovação automática' },
            { ...requests.data[1], status: 'REJECTED', decidedBy: { id: 'u1', name: 'Dona Ana' }, decidedAt: first.requestedAt, decisionReason: 'Tem parcelas atrasadas' },
          ],
          pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
        });
      }),
    );
    renderPage();
    await screen.findByText('Maria Oliveira');

    await userEvent.click(screen.getByRole('button', { name: 'Recusados' }));
    expect(await screen.findByText('Tem parcelas atrasadas')).toBeInTheDocument();
    expect(screen.getByText(/Dona Ana/)).toBeInTheDocument();
    expect(screen.getByText('Automático')).toBeInTheDocument();
    expect(statuses).toContain('REJECTED');
    expect(screen.queryByRole('button', { name: /Aprovar pedido de/ })).not.toBeInTheDocument();
  });

  test('sem pedidos mostra o estado vazio', async () => {
    server.use(http.get(`${API_URL}/credit/limit-requests`, () => HttpResponse.json({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } })));
    renderPage();

    expect(await screen.findByText('Nenhum pedido de aumento')).toBeInTheDocument();
  });

  test('no celular vira cartões e as ações ficam no menu do cartão', async () => {
    setViewport(375, { pointer: 'coarse' });
    renderPage();

    await screen.findByText('Maria Oliveira');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: /Mais ações/ })[1]);
    expect(await screen.findByRole('button', { name: /Aprovar pedido de Carlos Souza/ })).toBeInTheDocument();
  });
});
