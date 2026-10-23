import { describe, expect, test } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';

import { PayableDetailPage } from '../PayableDetailPage';
import { renderWithProviders } from '@/test/render';
import { loginAs } from '@/test/auth';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import payableDetail from '@/test/fixtures/finance/payableDetail.json';

const id = payableDetail.data.id;
const parcel2 = payableDetail.data.parcels[1];
const activePaymentId = payableDetail.data.parcels[0].payments[1].id;

function renderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/payables/:id" element={<PayableDetailPage />} />
    </Routes>,
    { route: `/payables/${id}` },
  );
}

describe('PayableDetailPage', () => {
  test('mostra fornecedor, link para o pedido e parcelas', async () => {
    renderDetail();
    expect(await screen.findByText('Distribuidora Boa Vista Ltda')).toBeInTheDocument();
    expect(screen.getByText('Fornecedor')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Conta a pagar/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pedido PC000012' })).toHaveAttribute('href', `/purchases/${payableDetail.data.originId}`);
    expect(screen.getByRole('link', { name: /Voltar para contas a pagar/ })).toHaveAttribute('href', '/payables');
  });

  test('pagar parcela envia o corpo certo e invalida o pedido de compra', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_URL}/payables/${id}/parcels/${parcel2.id}/payments`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: { ...payableDetail.data, paidAmount: 106.46 } }, { status: 201 });
      }),
    );
    renderDetail();
    await screen.findByText('Distribuidora Boa Vista Ltda');
    await userEvent.click(within(screen.getByTestId(`parcel-${parcel2.number}`)).getByRole('button', { name: 'Registrar pagamento' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText('Forma de pagamento'), 'PIX');
    await userEvent.type(within(dialog).getByLabelText('Referência'), 'NF 99');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar pagamento' }));

    await waitFor(() => expect(body).toMatchObject({ amount: parcel2.remainingAmount, method: 'PIX', reference: 'NF 99' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  test('estornar exige motivo e envia POST /payables/payments/:id/reverse', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_URL}/payables/payments/${activePaymentId}/reverse`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: payableDetail.data });
      }),
    );
    renderDetail();
    await screen.findByText('Distribuidora Boa Vista Ltda');
    await userEvent.click(within(screen.getByTestId(`payment-${activePaymentId}`)).getByRole('button', { name: 'Estornar' }));
    const dialog = await screen.findByRole('dialog');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar estorno' }));
    expect(await within(dialog).findByText('Informe o motivo (3 a 200 caracteres).')).toBeInTheDocument();
    expect(body).toBeNull();

    await userEvent.type(within(dialog).getByLabelText('Motivo'), 'Valor errado');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar estorno' }));
    await waitFor(() => expect(body).toEqual({ reason: 'Valor errado' }));
  });

  test('botões por permissão: sem payables.* não aparecem pagar/estornar', async () => {
    loginAs('VENDEDOR');
    renderDetail();
    await screen.findByText('Distribuidora Boa Vista Ltda');
    expect(screen.queryByRole('button', { name: 'Registrar pagamento' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Estornar' })).toBeNull();
  });

  test('ADMIN vê pagar e estornar', async () => {
    loginAs('ADMIN');
    renderDetail();
    await screen.findByText('Distribuidora Boa Vista Ltda');
    expect(screen.getAllByRole('button', { name: 'Registrar pagamento' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Estornar' }).length).toBeGreaterThan(0);
  });
});
