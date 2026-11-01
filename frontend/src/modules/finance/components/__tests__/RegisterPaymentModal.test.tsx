import { afterEach, describe, expect, test } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { RegisterPaymentModal } from '../RegisterPaymentModal';
import type { IFinanceParcel } from '../../types';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { loginAs, resetSession } from '@/test/auth';
import { todayInBusinessTz } from '@/shared/utils/businessDate';
import receivableDetail from '@/test/fixtures/finance/receivableDetail.json';
import payableDetail from '@/test/fixtures/finance/payableDetail.json';

const documentId = receivableDetail.data.id;
const parcel = receivableDetail.data.parcels[1] as unknown as IFinanceParcel; // vencida, restante 53,23
const paymentsUrl = `${API_URL}/receivables/${documentId}/parcels/${parcel.id}/payments`;

function renderModal(kind: 'receivable' | 'payable' = 'receivable') {
  const docId = kind === 'receivable' ? documentId : payableDetail.data.id;
  const p = kind === 'receivable' ? parcel : (payableDetail.data.parcels[1] as unknown as IFinanceParcel);
  return renderWithProviders(<RegisterPaymentModal kind={kind} documentId={docId} parcel={p} onClose={() => {}} />);
}

const row = (dialog: HTMLElement, label: string) => within(dialog).getByTestId(`late-fee-${label}`);

afterEach(() => resetSession());

describe('RegisterPaymentModal — multa e juros', () => {
  test('conta a receber vencida: mostra principal, multa, juros, total devido e o recebido em caixa', async () => {
    loginAs('VENDEDOR');
    renderModal();
    const dialog = await screen.findByRole('dialog');

    expect(await within(dialog).findByTestId('late-fee-fine')).toHaveTextContent('1,06');
    expect(row(dialog, 'principal')).toHaveTextContent('53,23');
    expect(row(dialog, 'interest')).toHaveTextContent('0,18');
    expect(row(dialog, 'interest')).toHaveTextContent('10 dias');
    expect(row(dialog, 'total-due')).toHaveTextContent('54,47');
    expect(row(dialog, 'received')).toHaveTextContent('54,47');

    // Pagamento parcial do principal: os encargos são cobrados por inteiro neste pagamento.
    const amount = within(dialog).getByLabelText('Valor');
    await userEvent.clear(amount);
    await userEvent.type(amount, '20');
    expect(row(dialog, 'received')).toHaveTextContent('21,24');

    // Sem credit.approve: sem campo de dispensa.
    expect(within(dialog).queryByLabelText('Dispensar')).toBeNull();
  });

  test('quote é pedido na data do pagamento escolhida', async () => {
    loginAs('ADMIN');
    const dates: (string | null)[] = [];
    server.use(
      http.get(`${API_URL}/receivables/:id/parcels/:parcelId/late-fees`, ({ request }) => {
        const date = new URL(request.url).searchParams.get('paymentDate');
        dates.push(date);
        return HttpResponse.json({ data: { principalRemaining: 53.23, daysLate: 2, fine: 0, interest: 0, totalDue: 53.23 } });
      }),
    );
    renderModal();
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dates).toContain(todayInBusinessTz()));
    const date = within(dialog).getByLabelText('Data do pagamento');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-10-20');
    await waitFor(() => expect(dates).toContain('2026-10-20'));
    expect(await within(dialog).findByText(/Sem multa nem juros/)).toBeInTheDocument();
  });

  test('com credit.approve (VENDEDOR marcado): dispensa com motivo vai no corpo e reduz o recebido', async () => {
    loginAs('VENDEDOR', { canApproveCredit: true });
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(paymentsUrl, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(receivableDetail, { status: 201 });
      }),
    );
    renderModal();
    const dialog = await screen.findByRole('dialog');
    const waive = await within(dialog).findByLabelText('Dispensar');

    await userEvent.type(waive, '1,30');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar pagamento' }));
    expect(await within(dialog).findByText(/^A dispensa não pode passar de multa \+ juros \(R\$\s1,24\)\.$/)).toBeInTheDocument();

    await userEvent.clear(waive);
    await userEvent.type(waive, '1,24');
    expect(row(dialog, 'received')).toHaveTextContent('53,23');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar pagamento' }));
    expect(await within(dialog).findByText('Informe o motivo da dispensa (3 a 200 caracteres).')).toBeInTheDocument();
    expect(body).toBeNull();

    await userEvent.type(within(dialog).getByLabelText('Motivo da dispensa'), 'Cliente antigo');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar pagamento' }));
    await waitFor(() =>
      expect(body).toEqual({ amount: 53.23, method: 'CASH', paymentDate: todayInBusinessTz(), waiveAmount: 1.24, waiverReason: 'Cliente antigo' }),
    );
  });

  test('erro 403 LATE_FEE_WAIVER_FORBIDDEN aparece no modal', async () => {
    loginAs('ADMIN');
    server.use(
      http.post(paymentsUrl, () =>
        HttpResponse.json({ code: 'LATE_FEE_WAIVER_FORBIDDEN', message: 'Só quem aprova crédito pode dispensar multa e juros.' }, { status: 403 }),
      ),
    );
    renderModal();
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(await within(dialog).findByLabelText('Dispensar'), '1');
    await userEvent.type(within(dialog).getByLabelText('Motivo da dispensa'), 'Cliente antigo');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar pagamento' }));
    expect(await within(dialog).findByText('Só quem aprova crédito pode dispensar multa e juros.')).toBeInTheDocument();
  });

  test('sem credit.approve, a receber: data do pagamento é hoje e só leitura; corpo sem motivo', async () => {
    loginAs('VENDEDOR');
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(paymentsUrl, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(receivableDetail, { status: 201 });
      }),
    );
    renderModal();
    const dialog = await screen.findByRole('dialog');
    const date = within(dialog).getByLabelText('Data do pagamento');
    expect(date).toHaveAttribute('readonly');
    expect(date).toHaveValue(todayInBusinessTz());
    expect(within(dialog).getByText('Só quem aprova crédito lança pagamento com data passada.')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Motivo da data passada')).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar pagamento' }));
    await waitFor(() => expect(body).toEqual({ amount: 53.23, method: 'CASH', paymentDate: todayInBusinessTz() }));
  });

  test('com credit.approve: data passada pede motivo (3 a 200) e envia backdateReason', async () => {
    loginAs('VENDEDOR', { canApproveCredit: true });
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(paymentsUrl, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(receivableDetail, { status: 201 });
      }),
    );
    renderModal();
    const dialog = await screen.findByRole('dialog');
    const date = within(dialog).getByLabelText('Data do pagamento');
    expect(date).not.toHaveAttribute('readonly');
    expect(within(dialog).queryByLabelText('Motivo da data passada')).toBeNull();
    await userEvent.clear(date);
    await userEvent.type(date, '2026-10-20');
    const reason = await within(dialog).findByLabelText('Motivo da data passada');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar pagamento' }));
    expect(await within(dialog).findByText('Informe o motivo da data passada (3 a 200 caracteres).')).toBeInTheDocument();
    expect(body).toBeNull();

    await userEvent.type(reason, ' Pagou no balcão ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar pagamento' }));
    await waitFor(() =>
      expect(body).toEqual({ amount: 53.23, method: 'CASH', paymentDate: '2026-10-20', backdateReason: 'Pagou no balcão' }),
    );
  });

  test('conta a pagar: data livre e sem motivo de data passada', async () => {
    loginAs('ADMIN');
    renderModal('payable');
    const dialog = await screen.findByRole('dialog');
    const date = within(dialog).getByLabelText('Data do pagamento');
    expect(date).not.toHaveAttribute('readonly');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-10-20');
    expect(within(dialog).queryByLabelText('Motivo da data passada')).toBeNull();
  });

  test('conta a pagar: sem consulta de encargos e sem resumo', async () => {
    loginAs('ADMIN');
    let quoted = 0;
    server.use(
      http.get(`${API_URL}/payables/:id/parcels/:parcelId/late-fees`, () => {
        quoted += 1;
        return HttpResponse.json({});
      }),
    );
    renderModal('payable');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByTestId('late-fee-fine')).toBeNull();
    expect(within(dialog).queryByLabelText('Dispensar')).toBeNull();
    expect(quoted).toBe(0);
  });
});
