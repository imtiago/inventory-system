import { describe, expect, test } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';

import { LegacyQuickEntryPage } from '../LegacyQuickEntryPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import legacyBatch from '@/test/fixtures/legacy-import/legacyBatch.json';

const BATCH_ID = legacyBatch.data.id;

function renderPage(route = '/finance/legacy-imports/quick') {
  const calls: { method: string; path: string; body: unknown }[] = [];
  server.use(
    http.post(`${API_URL}/legacy-imports`, async ({ request }) => {
      calls.push({ method: 'POST', path: '/legacy-imports', body: await request.json() });
      return HttpResponse.json({ data: { ...legacyBatch.data, rows: [] } }, { status: 201 });
    }),
    http.post(`${API_URL}/legacy-imports/:id/rows`, async ({ params, request }) => {
      calls.push({ method: 'POST', path: `/legacy-imports/${params.id as string}/rows`, body: await request.json() });
      return HttpResponse.json(legacyBatch, { status: 201 });
    }),
    http.get(`${API_URL}/customers`, ({ request }) => {
      const search = new URL(request.url).searchParams.get('search') ?? '';
      const all = [{ id: 'c-ana', name: 'Ana Paula Ribeiro', code: 'C0001', email: null, phone: '11999990000', address: null, document: null, createdAt: '2026-10-01T12:00:00.000Z' }];
      const data = all.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
      return HttpResponse.json({ data, pagination: { page: 1, limit: 20, total: data.length, totalPages: 1 } });
    }),
  );
  const view = renderWithProviders(
    <Routes>
      <Route path="/finance/legacy-imports/quick" element={<LegacyQuickEntryPage />} />
      <Route path="/finance/legacy-imports/:id/quick" element={<LegacyQuickEntryPage />} />
      <Route path="/finance/legacy-imports/:id" element={<div>Revisão do lote</div>} />
    </Routes>,
    { route },
  );
  return { ...view, calls };
}

describe('LegacyQuickEntryPage', () => {
  test('cliente novo com várias dívidas: cria o lote, adiciona e vai para a revisão', async () => {
    const { calls } = renderPage();

    await userEvent.click(screen.getByRole('radio', { name: 'Cliente novo' }));
    await userEvent.type(screen.getByLabelText('Nome do cliente'), 'Maria das Dores');
    await userEvent.type(screen.getByLabelText('Celular (opcional)'), '11988887777');

    await userEvent.type(screen.getByLabelText('Valor da dívida 1'), '150,00');
    await userEvent.type(screen.getByLabelText('Data da compra da dívida 1 (se souber)'), '2026-03-05');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar outra dívida' }));
    await userEvent.type(screen.getByLabelText('Valor da dívida 2'), '80,50');
    await userEvent.type(screen.getByLabelText('Observação da dívida 2'), 'Fiado do Natal');

    await userEvent.click(screen.getByRole('button', { name: 'Adicionar e revisar' }));

    expect(await screen.findByText('Revisão do lote')).toBeInTheDocument();
    expect(calls).toEqual([
      { method: 'POST', path: '/legacy-imports', body: { source: 'MANUAL' } },
      {
        method: 'POST',
        path: `/legacy-imports/${BATCH_ID}/rows`,
        body: {
          customer: { name: 'Maria das Dores', phone: '11988887777' },
          debts: [
            { amount: 150, purchaseDate: '2026-03-05' },
            { amount: 80.5, notes: 'Fiado do Natal' },
          ],
        },
      },
    ]);
  });

  test('cliente cadastrado escolhido na busca', async () => {
    const { calls } = renderPage();

    const search = screen.getByRole('combobox', { name: 'Buscar cliente' });
    await userEvent.type(search, 'Ana');
    await userEvent.click(within(await screen.findByRole('option', { name: /Ana Paula Ribeiro/ })).getByRole('button'));
    await userEvent.type(screen.getByLabelText('Valor da dívida 1'), '35,00');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar e revisar' }));

    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1].body).toEqual({ customer: { existingId: 'c-ana' }, debts: [{ amount: 35 }] });
  });

  test('no lote existente adiciona sem criar outro lote', async () => {
    const { calls } = renderPage(`/finance/legacy-imports/${BATCH_ID}/quick`);

    await userEvent.click(screen.getByRole('radio', { name: 'Cliente novo' }));
    await userEvent.type(screen.getByLabelText('Nome do cliente'), 'José');
    await userEvent.type(screen.getByLabelText('Valor da dívida 1'), '10,00');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar e lançar outro' }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].path).toBe(`/legacy-imports/${BATCH_ID}/rows`);
    // Continua na tela, pronta para o próximo cliente.
    expect(await screen.findByText(/Lançamento adicionado ao lote/)).toBeInTheDocument();
    expect(screen.getByLabelText('Valor da dívida 1')).toHaveValue('');
  });

  test('valida cliente e valor antes de enviar', async () => {
    const { calls } = renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Adicionar e revisar' }));

    expect(screen.getByText('Escolha um cliente cadastrado ou informe um novo.')).toBeInTheDocument();
    expect(screen.getByLabelText('Valor da dívida 1')).toHaveAttribute('aria-invalid', 'true');
    expect(within(screen.getByTestId('debt-0')).getByText('Informe um valor')).toBeInTheDocument();
    expect(calls).toEqual([]);
  });

  test('erro do servidor aparece na tela', async () => {
    const { calls } = renderPage(`/finance/legacy-imports/${BATCH_ID}/quick`);
    server.use(
      http.post(`${API_URL}/legacy-imports/:id/rows`, () =>
        HttpResponse.json({ message: 'O lote já foi confirmado ou desfeito e não pode mais ser alterado.', code: 'LEGACY_BATCH_NOT_DRAFT' }, { status: 409 }),
      ),
    );

    await userEvent.click(screen.getByRole('radio', { name: 'Cliente novo' }));
    await userEvent.type(screen.getByLabelText('Nome do cliente'), 'José');
    await userEvent.type(screen.getByLabelText('Valor da dívida 1'), '10,00');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar e revisar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('O lote já foi confirmado ou desfeito e não pode mais ser alterado.');
    expect(calls).toEqual([]);
  });
});
