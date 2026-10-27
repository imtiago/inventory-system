import { describe, expect, test, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';

import { PurchaseDetailPage } from '../PurchaseDetailPage';
import { renderWithProviders } from '@/test/render';
import { loginAs } from '@/test/auth';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import purchaseDetail from '@/test/fixtures/purchases/purchaseDetail.json';
import { setViewport } from '@/test/viewport';

const pending = {
  data: {
    ...purchaseDetail.data,
    status: 'PENDING',
    items: purchaseDetail.data.items.map((i) => ({ ...i, receivedQuantity: 0, remainingQuantity: i.quantity })),
  },
};

const ITEM1 = purchaseDetail.data.items[0].id;

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/purchases/:id" element={<PurchaseDetailPage />} />
    </Routes>,
    { route: `/purchases/${purchaseDetail.data.id}` },
  );
}

let posted: unknown;

beforeEach(() => {
  posted = undefined;
});

describe('PurchaseDetailPage no celular', () => {
  test('itens e parcelas viram cartões empilhados, sem tabela', async () => {
    setViewport(375);
    renderPage();

    expect(await screen.findByText('PC000012')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(4);
    expect(within(cards[0]).getByText('Camiseta Básica Azul M')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Recebido')).toBeInTheDocument();
    expect(within(cards[2]).getByText('Status')).toBeInTheDocument();
  });

  test('a partir de md continua sendo tabela', async () => {
    setViewport(1024);
    renderPage();

    await screen.findByText('PC000012');
    expect(screen.getAllByRole('table')).toHaveLength(2);
  });
});

describe('PurchaseDetailPage', () => {
  test('cabeçalho, itens e parcelas com link para contas a pagar (ADMIN)', async () => {
    renderPage();

    expect(await screen.findByText('PC000012')).toBeInTheDocument();
    expect(screen.getByText('Distribuidora Têxtil Ltda')).toBeInTheDocument();
    expect(screen.getByText('Recebido parcialmente', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Camiseta Básica Azul M')).toBeInTheDocument();
    expect(screen.getByText('Parcelas')).toBeInTheDocument();
    expect(screen.getAllByText('A vencer')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Ver contas a pagar' })).toHaveAttribute('href', `/payables/${purchaseDetail.data.payable.id}`);
    // recebimento parcial: não pode cancelar
    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument();
  });

  test('ESTOQUISTA: recebe, mas não cancela nem vê link de contas a pagar', async () => {
    loginAs('ESTOQUISTA');
    server.use(http.get(`${API_URL}/purchases/:id`, () => HttpResponse.json(pending)));
    renderPage();

    await screen.findByText('PC000012');
    expect(screen.getByRole('button', { name: 'Registrar recebimento' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver contas a pagar' })).not.toBeInTheDocument();
    // sem payables.read: nenhuma parcela, mesmo que o payload traga (defesa em profundidade)
    expect(screen.queryByText('Parcelas')).not.toBeInTheDocument();
    expect(screen.queryByText('A vencer')).not.toBeInTheDocument();
  });

  test('pedido pendente com pagamento registrado esconde "Cancelar pedido" e explica', async () => {
    const paid = {
      data: {
        ...pending.data,
        payable: { ...pending.data.payable, parcels: pending.data.payable.parcels.map((p, i) => (i === 0 ? { ...p, paidAmount: 5, remainingAmount: p.amount - 5 } : p)) },
      },
    };
    server.use(http.get(`${API_URL}/purchases/:id`, () => HttpResponse.json(paid)));
    renderPage();

    expect(await screen.findByTestId('cancel-blocked')).toHaveTextContent(/pagamento registrado/i);
    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument();
  });

  test('pedido pendente sem pagamento mostra "Cancelar pedido"', async () => {
    server.use(http.get(`${API_URL}/purchases/:id`, () => HttpResponse.json(pending)));
    renderPage();

    expect(await screen.findByRole('button', { name: 'Cancelar pedido' })).toBeInTheDocument();
    expect(screen.queryByTestId('cancel-blocked')).not.toBeInTheDocument();
  });

  test('ESTOQUISTA com payable null: página renderiza sem parcelas e sem erro', async () => {
    loginAs('ESTOQUISTA');
    server.use(http.get(`${API_URL}/purchases/:id`, () => HttpResponse.json({ data: { ...pending.data, payable: null } })));
    renderPage();

    expect(await screen.findByText('PC000012')).toBeInTheDocument();
    expect(screen.queryByText('Parcelas')).not.toBeInTheDocument();
    expect(screen.getByText('Informações financeiras disponíveis para administradores.')).toBeInTheDocument();
  });

  test('recebimento: BATCH_ALREADY_EXISTS mostra a mensagem do backend e a dica de outro lote', async () => {
    server.use(
      http.post(`${API_URL}/purchases/:id/receipts`, () =>
        HttpResponse.json({ message: 'Já existe um lote com este número.', code: 'BATCH_ALREADY_EXISTS' }, { status: 409 }),
      ),
    );
    renderPage();
    await screen.findByText('PC000012');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar recebimento' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Lote de Camiseta Básica Azul M'), 'L-001');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar recebimento' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Já existe um lote com este número.');
    expect(alert).toHaveTextContent('Use outro número de lote (ex.: acrescente o código do pedido).');
  });

  test('recebimento parcial envia { items: [{ purchaseItemId, quantity, batchNumber }] } e omite quantidade 0', async () => {
    server.use(
      http.get(`${API_URL}/purchases/:id`, () => HttpResponse.json(purchaseDetail)),
      http.post(`${API_URL}/purchases/:id/receipts`, async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json(purchaseDetail, { status: 201 });
      }),
    );
    renderPage();
    await screen.findByText('PC000012');

    await userEvent.click(screen.getByRole('button', { name: 'Registrar recebimento' }));
    const dialog = screen.getByRole('dialog');
    const qty1 = within(dialog).getByLabelText('Quantidade a receber de Camiseta Básica Azul M');
    expect(qty1).toHaveValue('2'); // padrão = restante
    await userEvent.clear(qty1);
    await userEvent.type(qty1, '1');
    await userEvent.type(within(dialog).getByLabelText('Lote de Camiseta Básica Azul M'), 'L-001');
    const qty2 = within(dialog).getByLabelText('Quantidade a receber de Camiseta Básica Preta G');
    await userEvent.clear(qty2);
    await userEvent.type(qty2, '0');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar recebimento' }));

    await waitFor(() => expect(posted).toEqual({ items: [{ purchaseItemId: ITEM1, quantity: 1, batchNumber: 'L-001' }] }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('recebimento: quantidade acima do restante é recusada e erro do backend aparece uma vez', async () => {
    server.use(
      http.post(`${API_URL}/purchases/:id/receipts`, () =>
        HttpResponse.json({ message: 'Quantidade excede o restante.', code: 'RECEIPT_EXCEEDS_REMAINING' }, { status: 422 }),
      ),
    );
    renderPage();
    await screen.findByText('PC000012');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar recebimento' }));
    const dialog = screen.getByRole('dialog');

    const qty1 = within(dialog).getByLabelText('Quantidade a receber de Camiseta Básica Azul M');
    await userEvent.clear(qty1);
    await userEvent.type(qty1, '5');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar recebimento' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('entre 0 e 2');

    await userEvent.clear(qty1);
    await userEvent.type(qty1, '1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar recebimento' }));
    expect(await screen.findAllByText('Quantidade excede o restante.')).toHaveLength(1);
  });

  test('cancelar exige motivo (3 a 200) e envia { reason }', async () => {
    server.use(
      http.get(`${API_URL}/purchases/:id`, () => HttpResponse.json(pending)),
      http.post(`${API_URL}/purchases/:id/cancel`, async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ data: { ...pending.data, status: 'CANCELED' } });
      }),
    );
    renderPage();
    await screen.findByText('PC000012');

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar cancelamento' }));
    expect(within(dialog).getByText(/motivo/i, { selector: 'p' })).toBeInTheDocument();
    expect(posted).toBeUndefined();

    await userEvent.type(within(dialog).getByLabelText('Motivo do cancelamento'), 'Pedido duplicado');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar cancelamento' }));

    await waitFor(() => expect(posted).toEqual({ reason: 'Pedido duplicado' }));
  });

  test('409 PURCHASE_HAS_PAYMENTS aparece uma vez', async () => {
    server.use(
      http.get(`${API_URL}/purchases/:id`, () => HttpResponse.json(pending)),
      http.post(`${API_URL}/purchases/:id/cancel`, () =>
        HttpResponse.json({ message: 'Pedido com pagamentos não pode ser cancelado.', code: 'PURCHASE_HAS_PAYMENTS' }, { status: 409 }),
      ),
    );
    renderPage();
    await screen.findByText('PC000012');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Motivo do cancelamento'), 'Erro de digitação');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar cancelamento' }));

    expect(await screen.findAllByText('Pedido com pagamentos não pode ser cancelado.')).toHaveLength(1);
  });

  test('pedido cancelado/recebido não mostra ações', async () => {
    server.use(http.get(`${API_URL}/purchases/:id`, () => HttpResponse.json({ data: { ...pending.data, status: 'CANCELED' } })));
    renderPage();
    await screen.findByText('PC000012');
    expect(screen.queryByRole('button', { name: 'Registrar recebimento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument();
  });
});

describe('PurchaseDetailPage: frete e outras despesas', () => {
  test('mostra o valor do pedido quando maior que zero e esconde quando zero', async () => {
    server.use(http.get(`${API_URL}/purchases/:id`, () => HttpResponse.json({ data: { ...purchaseDetail.data, extraCosts: 12.5 } })));
    const { unmount } = renderPage();
    expect(await screen.findByTestId('purchase-extra-costs')).toHaveTextContent(/Frete e outras despesas da compra: R\$\s?12,50/);
    unmount();

    server.use(http.get(`${API_URL}/purchases/:id`, () => HttpResponse.json(purchaseDetail)));
    renderPage();
    await screen.findByText('PC000012');
    expect(screen.queryByTestId('purchase-extra-costs')).not.toBeInTheDocument();
  });
});
