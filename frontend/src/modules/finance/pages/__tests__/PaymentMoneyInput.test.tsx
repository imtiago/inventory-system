import { describe, expect, test } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';

import { ReceivableDetailPage } from '@/modules/receivables/pages/ReceivableDetailPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { setViewport } from '@/test/viewport';
import { API_URL } from '@/test/handlers/inventory';
import receivableDetail from '@/test/fixtures/finance/receivableDetail.json';

const id = receivableDetail.data.id;
const parcel2 = receivableDetail.data.parcels[1];

async function openDialog() {
  renderWithProviders(
    <Routes>
      <Route path="/receivables/:id" element={<ReceivableDetailPage />} />
    </Routes>,
    { route: `/receivables/${id}` },
  );
  await screen.findByText('Maria Oliveira');
  await userEvent.click(within(screen.getByTestId(`parcel-${parcel2.number}`)).getByRole('button', { name: 'Registrar pagamento' }));
  return screen.findByRole('dialog');
}

describe('Registrar pagamento usa o MoneyInput compartilhado', () => {
  test('campo com prefixo R$, teclado decimal e "12,50" envia 12.5', async () => {
    let body: { amount?: number } = {};
    server.use(
      http.post(`${API_URL}/receivables/${id}/parcels/${parcel2.id}/payments`, async ({ request }) => {
        body = (await request.json()) as { amount: number };
        return HttpResponse.json(receivableDetail);
      }),
    );
    const dialog = await openDialog();
    const amount = within(dialog).getByLabelText('Valor');

    expect(within(dialog).getByText('R$')).toBeInTheDocument();
    expect(amount).toHaveAttribute('inputmode', 'decimal');

    await userEvent.clear(amount);
    await userEvent.type(amount, '12,50');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar pagamento' }));

    await waitFor(() => expect(body.amount).toBe(12.5));
  });

  test('em toque o modal foca o próprio diálogo, não o primeiro campo', async () => {
    setViewport(375, { pointer: 'coarse' });
    const dialog = await openDialog();
    expect(dialog).toHaveFocus();
  });

  test('com ponteiro fino foca o primeiro campo', async () => {
    setViewport(1280, { pointer: 'fine' });
    const dialog = await openDialog();
    expect(dialog).not.toHaveFocus();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
