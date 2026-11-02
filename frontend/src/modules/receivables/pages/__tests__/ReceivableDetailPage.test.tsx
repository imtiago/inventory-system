import { afterEach, describe, expect, test, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';

import { ReceivableDetailPage } from '../ReceivableDetailPage';
import { FinanceDetailPage } from '@/modules/finance/pages/FinanceDetailPage';
import payableDetail from '@/test/fixtures/finance/payableDetail.json';
import { SaleDetailPage } from '@/modules/sales/pages/SaleDetailPage';
import { todayInBusinessTz } from '@/shared/utils/businessDate';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import receivableDetail from '@/test/fixtures/finance/receivableDetail.json';
import saleDetail from '@/test/fixtures/sales/saleDetail.json';

const id = receivableDetail.data.id;
const parcel2 = receivableDetail.data.parcels[1];
const activePaymentId = receivableDetail.data.parcels[0].payments[1].id;

function renderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/receivables/:id" element={<ReceivableDetailPage />} />
    </Routes>,
    { route: `/receivables/${id}` },
  );
}

function paidParcel2() {
  return {
    data: {
      ...receivableDetail.data,
      paidAmount: 106.46,
      parcels: receivableDetail.data.parcels.map((p) => (p.id === parcel2.id ? { ...p, status: 'PAID', paidAmount: 53.23, remainingAmount: 0 } : p)),
    },
  };
}

afterEach(() => vi.useRealTimers());

describe('ReceivableDetailPage', () => {
  test('detalhe mostra parcelas, pagamentos e estornados riscados com motivo', async () => {
    renderDetail();

    expect(await screen.findByText('Maria Oliveira')).toBeInTheDocument();
    expect(screen.getAllByText('Vencida')).toHaveLength(2);
    expect(screen.getAllByText(/159,70/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Vencimento 21\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByText('Venda de origem')).toHaveAttribute('href', `/sales/${receivableDetail.data.originId}`);

    const reversed = screen.getByTestId(`payment-${receivableDetail.data.parcels[0].payments[0].id}`);
    expect(reversed.querySelector('.line-through')).not.toBeNull();
    expect(within(reversed).getByText('Dinheiro', { exact: false })).toBeInTheDocument();
    expect(within(reversed).getByText(/Estornado em .+ por Ana Gerente: Lançado em duplicidade/)).toBeInTheDocument();
    expect(within(reversed).queryByRole('button', { name: 'Estornar' })).toBeNull();

    const active = screen.getByTestId(`payment-${activePaymentId}`);
    expect(within(active).getByText(/PIX/)).toBeInTheDocument();
    expect(within(active).getByText(/PIX 123456/)).toBeInTheDocument();
    expect(within(active).getByRole('button', { name: 'Estornar' })).toBeInTheDocument();
  });

  test('Recibo: baixa o PDF do pagamento ativo; estornado não tem recibo', async () => {
    const downloads: string[] = [];
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => 'blob:fake') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
    let requested = '';
    server.use(
      http.get(`${API_URL}/receivables/payments/:paymentId/receipt.pdf`, ({ params }) => {
        requested = String(params.paymentId);
        return new HttpResponse('%PDF-1.3 fake', { headers: { 'Content-Type': 'application/pdf' } });
      }),
    );
    try {
      renderDetail();
      await screen.findByText('Maria Oliveira');

      const reversed = screen.getByTestId(`payment-${receivableDetail.data.parcels[0].payments[0].id}`);
      expect(within(reversed).queryByRole('button', { name: /Recibo/ })).toBeNull();

      const active = screen.getByTestId(`payment-${activePaymentId}`);
      await userEvent.click(within(active).getByRole('button', { name: /^Recibo do pagamento de/ }));
      await waitFor(() => expect(downloads).toEqual([`recibo-${activePaymentId.slice(0, 8).toUpperCase()}.pdf`]));
      expect(requested).toBe(activePaymentId);
    } finally {
      click.mockRestore();
    }
  });

  test('contas a pagar não tem Recibo', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/payables/:id" element={<FinanceDetailPage kind="payable" />} />
      </Routes>,
      { route: `/payables/${payableDetail.data.id}` },
    );
    await screen.findByText(/Conta a pagar #/);
    await screen.findAllByRole('button', { name: /Estornar|Registrar pagamento/ });
    expect(screen.queryByRole('button', { name: /Recibo/ })).toBeNull();
  });

  test('data padrão do pagamento usa o dia de São Paulo, não o do navegador', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-24T02:00:00Z')); // 23/10 23:00 em São Paulo
    renderDetail();
    await screen.findByText('Maria Oliveira');

    await userEvent.click(within(screen.getByTestId(`parcel-${parcel2.number}`)).getByRole('button', { name: 'Registrar pagamento' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Data do pagamento')).toHaveValue('2026-10-23');
  });

  test('registrar pagamento envia { amount, method, paymentDate, reference } e atualiza a tela', async () => {
    let body: Record<string, unknown> | null = null;
    let key: string | null = null;
    server.use(
      http.post(`${API_URL}/receivables/${id}/parcels/${parcel2.id}/payments`, async ({ request }) => {
        key = request.headers.get('Idempotency-Key');
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(paidParcel2(), { status: 201 });
      }),
    );
    renderDetail();
    await screen.findByText('Maria Oliveira');

    await userEvent.click(within(screen.getByTestId(`parcel-${parcel2.number}`)).getByRole('button', { name: 'Registrar pagamento' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Valor')).toHaveValue('53,23');
    expect(within(dialog).getByLabelText('Data do pagamento')).toHaveValue(todayInBusinessTz());

    await userEvent.selectOptions(within(dialog).getByLabelText('Forma de pagamento'), 'PIX');
    await userEvent.type(within(dialog).getByLabelText('Referência'), 'PIX 999');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar pagamento' }));

    await waitFor(() => expect(body).toEqual({ amount: 53.23, method: 'PIX', paymentDate: todayInBusinessTz(), reference: 'PIX 999' }));
    expect(key).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const section = screen.getByTestId(`parcel-${parcel2.number}`);
    expect(within(section).getByText('Paga')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Registrar pagamento' })).toBeDisabled();
  });

  test('valor acima do restante é bloqueado na tela; erro 422 do backend aparece uma vez', async () => {
    let calls = 0;
    server.use(
      http.post(`${API_URL}/receivables/${id}/parcels/${parcel2.id}/payments`, () => {
        calls += 1;
        return HttpResponse.json({ code: 'PAYMENT_EXCEEDS_REMAINING', message: 'Valor excede o saldo da parcela.' }, { status: 422 });
      }),
    );
    renderDetail();
    await screen.findByText('Maria Oliveira');
    await userEvent.click(within(screen.getByTestId(`parcel-${parcel2.number}`)).getByRole('button', { name: 'Registrar pagamento' }));
    const dialog = await screen.findByRole('dialog');

    const amount = within(dialog).getByLabelText('Valor');
    await userEvent.clear(amount);
    await userEvent.type(amount, '60');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar pagamento' }));
    expect(await within(dialog).findByText('O valor não pode ser maior que o saldo da parcela.')).toBeInTheDocument();
    expect(calls).toBe(0);

    await userEvent.clear(amount);
    await userEvent.type(amount, '10.50');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar pagamento' }));
    await waitFor(() => expect(calls).toBe(1));
    expect(await screen.findAllByText('Valor excede o saldo da parcela.')).toHaveLength(1);
  });

  test('botão de pagamento desabilitado em parcela paga e em documento cancelado', async () => {
    const { unmount } = renderDetail();
    await screen.findByText('Maria Oliveira');
    expect(within(screen.getByTestId('parcel-1')).getByRole('button', { name: 'Registrar pagamento' })).toBeDisabled();
    expect(within(screen.getByTestId('parcel-2')).getByRole('button', { name: 'Registrar pagamento' })).toBeEnabled();
    unmount();

    server.use(
      http.get(`${API_URL}/receivables/:id`, () =>
        HttpResponse.json({ data: { ...receivableDetail.data, status: 'CANCELED', displayStatus: 'CANCELED' } }),
      ),
    );
    renderDetail();
    await screen.findByText('Maria Oliveira');
    for (const n of [1, 2, 3]) {
      expect(within(screen.getByTestId(`parcel-${n}`)).getByRole('button', { name: 'Registrar pagamento' })).toBeDisabled();
    }
    expect(screen.queryByRole('button', { name: 'Estornar' })).toBeNull();
  });

  test('estornar exige motivo e envia POST /receivables/payments/:id/reverse', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_URL}/receivables/payments/${activePaymentId}/reverse`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: { ...receivableDetail.data, status: 'OPEN' } });
      }),
    );
    renderDetail();
    await screen.findByText('Maria Oliveira');
    await userEvent.click(within(screen.getByTestId(`payment-${activePaymentId}`)).getByRole('button', { name: 'Estornar' }));
    const dialog = await screen.findByRole('dialog');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar estorno' }));
    expect(await within(dialog).findByText('Informe o motivo (3 a 200 caracteres).')).toBeInTheDocument();
    expect(body).toBeNull();

    await userEvent.type(within(dialog).getByLabelText('Motivo'), 'Valor errado');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar estorno' }));
    await waitFor(() => expect(body).toEqual({ reason: 'Valor errado' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  test('404 mostra mensagem com link de volta', async () => {
    server.use(http.get(`${API_URL}/receivables/:id`, () => HttpResponse.json({ code: 'FINANCIAL_DOCUMENT_NOT_FOUND', message: 'x' }, { status: 404 })));
    renderDetail();
    expect(await screen.findByText('Conta a receber não encontrada.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voltar para contas a receber/ })).toHaveAttribute('href', '/receivables');
  });

  test('detalhe da venda linka para o contas a receber', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/sales/:id" element={<SaleDetailPage />} />
      </Routes>,
      { route: `/sales/${saleDetail.data.id}` },
    );
    const link = await screen.findByRole('link', { name: 'Ver contas a receber' });
    expect(link).toHaveAttribute('href', `/receivables/${saleDetail.data.receivable!.id}`);
  });

  test('pagamento com encargos mostra multa, juros, dispensa e o recebido em caixa; parcela vencida mostra encargos de hoje', async () => {
    const withFees = structuredClone(receivableDetail);
    const payment = withFees.data.parcels[0].payments[1] as Record<string, unknown>;
    Object.assign(payment, {
      fineAmount: 1.06,
      interestAmount: 0.35,
      waivedAmount: 0.41,
      waiverReason: 'Cliente antigo',
      waivedBy: { id: 'u-1', name: 'Ana Gerente' },
      receivedAmount: 54.23,
    });
    server.use(http.get(`${API_URL}/receivables/:id`, () => HttpResponse.json(withFees)));
    renderDetail();
    await screen.findByText('Maria Oliveira');

    const active = screen.getByTestId(`payment-${activePaymentId}`);
    expect(within(active).getByText(/Multa R\$\s1,06/)).toBeInTheDocument();
    expect(within(active).getByText(/Juros R\$\s0,35/)).toBeInTheDocument();
    expect(within(active).getByText(/Dispensado R\$\s0,41 por Ana Gerente: Cliente antigo/)).toBeInTheDocument();
    expect(within(active).getByText(/Recebido em caixa R\$\s54,23/)).toBeInTheDocument();

    const overdue = screen.getByTestId(`parcel-${parcel2.number}`);
    expect(within(overdue).getByText(/Se paga hoje: multa R\$\s1,06 · juros R\$\s0,18 · total R\$\s54,47/)).toBeInTheDocument();
    expect(within(screen.getByTestId('parcel-3')).queryByText(/Se paga hoje/)).toBeNull();
  });

  test('pagamento lançado com data passada mostra o motivo', async () => {
    const backdated = structuredClone(receivableDetail);
    Object.assign(backdated.data.parcels[0].payments[1] as Record<string, unknown>, { backdateReason: 'Pagou no balcão, lançado hoje' });
    server.use(http.get(`${API_URL}/receivables/:id`, () => HttpResponse.json(backdated)));
    renderDetail();
    await screen.findByText('Maria Oliveira');
    const active = screen.getByTestId(`payment-${activePaymentId}`);
    expect(within(active).getByText('Data passada: Pagou no balcão, lançado hoje')).toBeInTheDocument();
  });

  test('documento sem encargos (venda antiga) avisa que não cobra multa nem juros', async () => {
    server.use(http.get(`${API_URL}/receivables/:id`, () => HttpResponse.json({ data: { ...receivableDetail.data, noLateFees: true } })));
    renderDetail();
    expect(await screen.findByText(/Sem multa nem juros de atraso/)).toBeInTheDocument();
  });
});
