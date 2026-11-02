import { afterEach, describe, expect, test } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { SplitParcelModal } from '../SplitParcelModal';
import type { IFinanceParcel } from '../../types';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { loginAs, resetSession } from '@/test/auth';
import legacyDetail from '@/test/fixtures/finance/receivableDetailLegacy.json';

const documentId = legacyDetail.data.id;
const parcel = legacyDetail.data.parcels[0] as unknown as IFinanceParcel; // saldo 350,00
const splitUrl = `${API_URL}/receivables/${documentId}/parcels/${parcel.id}/split`;

afterEach(() => resetSession());

function renderModal() {
  return renderWithProviders(<SplitParcelModal documentId={documentId} parcel={parcel} onClose={() => {}} />);
}

async function setCount(dialog: HTMLElement, count: string) {
  const field = within(dialog).getByLabelText('Número de parcelas');
  await userEvent.clear(field);
  await userEvent.type(field, count);
}

async function setFirstDate(dialog: HTMLElement, date: string) {
  const field = within(dialog).getByLabelText('Primeiro vencimento');
  await userEvent.clear(field);
  await userEvent.type(field, date);
}

describe('SplitParcelModal', () => {
  test('sugere N parcelas mensais iguais, a última com o resto', async () => {
    loginAs('ADMIN');
    renderModal();
    const dialog = await screen.findByRole('dialog');

    await setFirstDate(dialog, '2099-01-15');
    await setCount(dialog, '3');

    expect(within(dialog).getByLabelText('Valor da parcela 1')).toHaveValue('116,66');
    expect(within(dialog).getByLabelText('Valor da parcela 2')).toHaveValue('116,66');
    expect(within(dialog).getByLabelText('Valor da parcela 3')).toHaveValue('116,68');
    expect(within(dialog).getByLabelText('Vencimento da parcela 1')).toHaveValue('2099-01-15');
    expect(within(dialog).getByLabelText('Vencimento da parcela 2')).toHaveValue('2099-02-15');
    expect(within(dialog).getByLabelText('Vencimento da parcela 3')).toHaveValue('2099-03-15');
    expect(within(dialog).getByTestId('split-sum')).toHaveTextContent('Soma confere');
    expect(within(dialog).getByRole('button', { name: 'Parcelar saldo' })).toBeEnabled();
  });

  test('editar um valor mostra a diferença e bloqueia o envio até a soma bater', async () => {
    loginAs('ADMIN');
    renderModal();
    const dialog = await screen.findByRole('dialog');
    await setFirstDate(dialog, '2099-01-15');
    await setCount(dialog, '2');

    const first = within(dialog).getByLabelText('Valor da parcela 1');
    await userEvent.clear(first);
    await userEvent.type(first, '100');

    expect(within(dialog).getByTestId('split-sum')).toHaveTextContent(/Faltam R\$\s*75,00/);
    expect(within(dialog).getByRole('button', { name: 'Parcelar saldo' })).toBeDisabled();

    const second = within(dialog).getByLabelText('Valor da parcela 2');
    await userEvent.clear(second);
    await userEvent.type(second, '250');
    expect(within(dialog).getByTestId('split-sum')).toHaveTextContent('Soma confere');
    expect(within(dialog).getByRole('button', { name: 'Parcelar saldo' })).toBeEnabled();
  });

  test('envia as parcelas com Idempotency-Key e reaproveita a chave ao repetir após erro', async () => {
    loginAs('ADMIN');
    const keys: (string | null)[] = [];
    const bodies: unknown[] = [];
    let calls = 0;
    server.use(
      http.post(splitUrl, async ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        bodies.push(await request.json());
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ code: 'SPLIT_DATES_INVALID', message: 'O vencimento não pode ser anterior a hoje.' }, { status: 422 });
        }
        return HttpResponse.json(legacyDetail, { status: 200 });
      }),
    );
    renderModal();
    const dialog = await screen.findByRole('dialog');
    await setFirstDate(dialog, '2099-01-15');
    await setCount(dialog, '2');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Parcelar saldo' }));
    expect(await within(dialog).findByText('O vencimento não pode ser anterior a hoje.')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Parcelar saldo' }));
    await waitFor(() => expect(calls).toBe(2));

    expect(bodies[0]).toEqual({
      parcels: [
        { dueDate: '2099-01-15', amount: 175 },
        { dueDate: '2099-02-15', amount: 175 },
      ],
    });
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });
});
