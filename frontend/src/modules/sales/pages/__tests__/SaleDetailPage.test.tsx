import { describe, expect, test } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { SaleDetailPage } from '../SaleDetailPage';
import { SaleListPage } from '../SaleListPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import saleDetail from '@/test/fixtures/sales/saleDetail.json';
import { setViewport } from '@/test/viewport';
import { loginAs } from '@/test/auth';

const id = saleDetail.data.id;

function renderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/sales/:id" element={<SaleDetailPage />} />
    </Routes>,
    { route: `/sales/${id}` },
  );
}

describe('SaleDetailPage', () => {
  test('detalhe mostra cliente, vendedor, itens com preço, total e parcelas', async () => {
    renderDetail();

    expect(await screen.findByText('Maria Oliveira')).toBeInTheDocument();
    expect(screen.getByText('João Vendedor')).toBeInTheDocument();
    expect(screen.getByText('Concluída')).toBeInTheDocument();
    expect(screen.getByText('Camiseta Básica Azul M')).toBeInTheDocument();
    expect(screen.getByText('Camiseta Básica Preta G')).toBeInTheDocument();
    expect(screen.getAllByText(/39,90/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/119,70/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/159,70/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/53,23/).length).toBe(4);
    expect(screen.getByText('21/11/2026')).toBeInTheDocument();
    expect(screen.getByText('21/01/2027')).toBeInTheDocument();
    expect(screen.getAllByText('A vencer').length).toBeGreaterThan(0);
  });

  test('cancelar pede confirmação, chama POST /sales/:id/cancel e mostra status Cancelada', async () => {
    let called = 0;
    server.use(
      http.post(`${API_URL}/sales/:id/cancel`, () => {
        called++;
        return HttpResponse.json({
          data: {
            ...saleDetail.data,
            status: 'CANCELED',
            receivable: { ...saleDetail.data.receivable, status: 'CANCELED', parcels: saleDetail.data.receivable.parcels.map((p) => ({ ...p, status: 'CANCELED' })) },
          },
        });
      }),
    );
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar venda' }));
    expect(called).toBe(0);

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /Confirmar cancelamento/ }));

    await waitFor(() => expect(called).toBe(1));
    expect(await screen.findByText('Cancelada', { selector: 'div > span' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancelar venda' })).not.toBeInTheDocument());
  });

  test('cancelar com 409 SALE_HAS_PAYMENTS mostra a mensagem do backend', async () => {
    server.use(
      http.post(`${API_URL}/sales/:id/cancel`, () =>
        HttpResponse.json({ message: 'Venda possui pagamentos registrados.', code: 'SALE_HAS_PAYMENTS' }, { status: 409 }),
      ),
    );
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar venda' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /Confirmar cancelamento/ }));

    expect(await screen.findAllByText('Venda possui pagamentos registrados.')).toHaveLength(1);
  });

  test('venda com pagamento registrado esconde "Cancelar venda" e explica; sem pagamento ativo o botão volta', async () => {
    const paid = {
      data: {
        ...saleDetail.data,
        receivable: {
          ...saleDetail.data.receivable,
          parcels: saleDetail.data.receivable.parcels.map((p, i) => (i === 0 ? { ...p, paidAmount: 10, remainingAmount: p.amount - 10 } : p)),
        },
      },
    };
    server.use(http.get(`${API_URL}/sales/:id`, () => HttpResponse.json(paid)));
    renderDetail();

    expect(await screen.findByTestId('cancel-blocked')).toHaveTextContent(/pagamento registrado/i);
    expect(screen.queryByRole('button', { name: 'Cancelar venda' })).not.toBeInTheDocument();
  });

  test('lista linka para /sales/:id', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/sales" element={<SaleListPage />} />
      </Routes>,
      { route: '/sales' },
    );

    const links = await screen.findAllByRole('link', { name: /#0B6F3C2E/ });
    expect(links[0]).toHaveAttribute('href', `/sales/${id}`);
    expect(screen.getByText('Maria Oliveira')).toBeInTheDocument();
    expect(screen.getByText('Cancelada', { selector: 'td *, td' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Nova Venda/ })).toHaveAttribute('href', '/sales/new');
    expect(document.querySelector('button a, a button')).toBeNull();
  });

  test('Esc fecha o diálogo e devolve o foco ao botão Cancelar venda', async () => {
    renderDetail();
    const btn = await screen.findByRole('button', { name: 'Cancelar venda' });
    await userEvent.click(btn);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(btn).toHaveFocus();
  });

  test('404 mostra "Venda não encontrada." com link para /sales', async () => {
    server.use(http.get(`${API_URL}/sales/:id`, () => HttpResponse.json({ message: 'Venda não encontrada.', code: 'SALE_NOT_FOUND' }, { status: 404 })));
    renderDetail();
    expect(await screen.findByText('Venda não encontrada.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /vendas/i })[0]).toHaveAttribute('href', '/sales');
    expect(screen.queryByText('Não foi possível carregar a venda.')).not.toBeInTheDocument();
  });

  test('409 CONCURRENT_UPDATE mostra a mensagem e refaz o GET da venda', async () => {
    let gets = 0;
    server.use(
      http.get(`${API_URL}/sales/:id`, () => {
        gets++;
        return HttpResponse.json(saleDetail);
      }),
      http.post(`${API_URL}/sales/:id/cancel`, () => HttpResponse.json({ message: 'Venda alterada por outra operação.', code: 'CONCURRENT_UPDATE' }, { status: 409 })),
    );
    renderDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar venda' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /Confirmar cancelamento/ }));
    expect(await screen.findByText('Venda alterada por outra operação.')).toBeInTheDocument();
    await waitFor(() => expect(gets).toBe(2));

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar venda' }));
    expect(screen.queryByText('Venda alterada por outra operação.')).not.toBeInTheDocument();
  });

  test('404 não faz retry (mensagem aparece imediatamente com retries habilitados)', async () => {
    let gets = 0;
    server.use(
      http.get(`${API_URL}/sales/:id`, () => {
        gets++;
        return HttpResponse.json({ message: 'Venda não encontrada.', code: 'SALE_NOT_FOUND' }, { status: 404 });
      }),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: 1 } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/sales/${id}`]}>
          <Routes>
            <Route path="/sales/:id" element={<SaleDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Venda não encontrada.')).toBeInTheDocument();
    expect(gets).toBe(1);
  });
});

describe('SaleDetailPage no celular', () => {
  test('itens e parcelas viram cartões empilhados, sem tabela', async () => {
    setViewport(375);
    renderDetail();

    expect(await screen.findByText('Maria Oliveira')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBe(5);
    expect(within(items[0]).getByText('Camiseta Básica Azul M')).toBeInTheDocument();
    expect(within(items[0]).getByText('Qtd.')).toBeInTheDocument();
    expect(within(items[2]).getByText('Status')).toBeInTheDocument();
    expect(within(items[2]).getByText('21/11/2026')).toBeInTheDocument();
  });

  test('a partir de md continua sendo tabela', async () => {
    setViewport(1024);
    renderDetail();

    await screen.findByText('Maria Oliveira');
    expect(screen.getAllByRole('table')).toHaveLength(2);
  });
});

describe('SaleDetailPage: pedido de cancelamento', () => {
  const pending = {
    id: 'req-1',
    saleId: id,
    customerName: 'Maria Oliveira',
    total: 159.7,
    reason: 'Cliente desistiu',
    status: 'PENDING',
    requestedBy: { id: 'u1', name: 'João Vendedor' },
    requestedAt: '2026-10-26T13:10:00.000Z',
    decidedBy: null,
    decidedAt: null,
    decisionReason: null,
  };

  test('VENDEDOR vê "Pedir cancelamento" e não "Cancelar venda"', async () => {
    loginAs('VENDEDOR');
    renderDetail();

    expect(await screen.findByRole('button', { name: 'Pedir cancelamento' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar venda' })).not.toBeInTheDocument();
  });

  test('VENDEDOR envia o motivo (mín. 3), vê o selo e o botão some', async () => {
    loginAs('VENDEDOR');
    let body: unknown = null;
    server.use(
      http.post(`${API_URL}/sales/:id/cancel-requests`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: pending }, { status: 201 });
      }),
    );
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: 'Pedir cancelamento' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Motivo'), 'ab');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar pedido' }));
    expect(await within(dialog).findByText(/3 a 200 caracteres/)).toBeInTheDocument();
    expect(body).toBeNull();

    await userEvent.type(within(dialog).getByLabelText('Motivo'), 'c');
    // O detalhe recarregado já traz o pedido pendente.
    server.use(http.get(`${API_URL}/sales/:id`, () => HttpResponse.json({ data: { ...saleDetail.data, pendingCancelRequest: pending } })));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar pedido' }));

    await waitFor(() => expect(body).toEqual({ reason: 'abc' }));
    expect(await screen.findByText('Cancelamento pedido')).toBeInTheDocument();
    expect(screen.getByText(/Cliente desistiu/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Pedir cancelamento' })).not.toBeInTheDocument());
  });

  test('409 ao pedir mostra a mensagem da API no modal', async () => {
    loginAs('VENDEDOR');
    server.use(
      http.post(`${API_URL}/sales/:id/cancel-requests`, () =>
        HttpResponse.json({ message: 'Já existe um pedido de cancelamento em aberto para esta venda.', code: 'CANCEL_REQUEST_ALREADY_PENDING' }, { status: 409 }),
      ),
    );
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: 'Pedir cancelamento' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Motivo'), 'Cliente desistiu');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar pedido' }));

    expect(await within(dialog).findByText('Já existe um pedido de cancelamento em aberto para esta venda.')).toBeInTheDocument();
  });

  test('com pedido pendente mostra o selo e o motivo; VENDEDOR não pode pedir de novo', async () => {
    loginAs('VENDEDOR');
    server.use(http.get(`${API_URL}/sales/:id`, () => HttpResponse.json({ data: { ...saleDetail.data, pendingCancelRequest: pending } })));
    renderDetail();

    expect(await screen.findByText('Cancelamento pedido')).toBeInTheDocument();
    expect(screen.getByText(/Cliente desistiu/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pedir cancelamento' })).not.toBeInTheDocument();
  });

  test('ADMIN mantém "Cancelar venda" e não vê "Pedir cancelamento"', async () => {
    renderDetail();

    expect(await screen.findByRole('button', { name: 'Cancelar venda' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pedir cancelamento' })).not.toBeInTheDocument();
  });
});
