import { afterEach, describe, expect, test } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { createTestQueryClient, renderWithProviders } from '@/test/render';
import { resetViewport, setViewport } from '@/test/viewport';
import review from '@/test/fixtures/credit/creditReviewItems.json';

import { CreditReviewPage } from '../CreditReviewPage';

afterEach(() => resetViewport());

const maria = review.data[0];
const carlos = { ...maria, customerId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', customerName: 'Carlos Souza', fromProfile: 'GOOD', toProfile: 'REGULAR', fromLimit: 2500, toLimit: 800, action: 'DOWN', reason: 'desceu para Regular: atraso de 31 dias no período', score: 30 };
const ana = { ...maria, customerId: 'c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f', customerName: 'Ana Lima', fromProfile: 'REGULAR', toProfile: 'REGULAR', fromLimit: 900, toLimit: 900, toStatus: 'SUSPENDED', action: 'SUSPEND', reason: 'suspenso: parcela vencida há 61 dias', score: 5 };

function mockPreview(items: unknown[] = [maria, carlos, ana]) {
  server.use(http.get(`${API_URL}/credit/review/preview`, () => HttpResponse.json({ data: items })));
}

function renderPage() {
  const queryClient = createTestQueryClient();
  const invalidated: string[] = [];
  const original = queryClient.invalidateQueries.bind(queryClient);
  queryClient.invalidateQueries = ((filters: { queryKey?: readonly unknown[] }) => {
    invalidated.push(String(filters?.queryKey?.[0]));
    return original(filters as never);
  }) as typeof queryClient.invalidateQueries;
  renderWithProviders(<CreditReviewPage />, { queryClient });
  return { invalidated };
}

describe('CreditReviewPage', () => {
  test('lista a prévia: cliente, de → para (perfil, limite, situação) e motivo; nada é aplicado sozinho', async () => {
    mockPreview();
    renderPage();

    expect(await screen.findByText('Maria Oliveira')).toBeInTheDocument();
    expect(screen.getByText('subiu para Regular: 9 parcelas em dia, 0 atrasos')).toBeInTheDocument();
    expect(screen.getByText('Carlos Souza')).toBeInTheDocument();
    expect(screen.getByText(/desceu para Regular/)).toBeInTheDocument();
    expect(screen.getByText('Ana Lima')).toBeInTheDocument();
    expect(screen.getByText(/R\$ 300,00/)).toBeInTheDocument();
    expect(screen.getAllByText(/R\$ 800,00/).length).toBeGreaterThan(0);
    expect(screen.getByText('Suspenso')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aplicar selecionados (0)' })).toBeDisabled();
  });

  test('aplicar só os selecionados: confirma no diálogo e envia customerIds com Idempotency-Key', async () => {
    mockPreview();
    let body: unknown = null;
    let key: string | null = null;
    server.use(
      http.post(`${API_URL}/credit/review/apply`, async ({ request }) => {
        key = request.headers.get('Idempotency-Key');
        body = await request.json();
        return HttpResponse.json({ data: [maria] });
      }),
    );
    const { invalidated } = renderPage();

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Selecionar Maria Oliveira' }));
    expect(screen.getByRole('button', { name: 'Aplicar selecionados (1)' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar selecionados (1)' }));

    const dialog = await screen.findByRole('dialog');
    expect(body).toBeNull();
    expect(within(dialog).getByText(/1 cliente/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aplicar' }));

    await waitFor(() => expect(body).toEqual({ customerIds: [maria.customerId] }));
    expect(key).toBeTruthy();
    await waitFor(() => expect(invalidated).toEqual(expect.arrayContaining(['credit', 'customers'])));
  });

  test('selecionar todos marca todos e o contador acompanha', async () => {
    mockPreview();
    renderPage();

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Selecionar todos' }));
    expect(screen.getByRole('button', { name: 'Aplicar selecionados (3)' })).toBeEnabled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Selecionar todos' }));
    expect(screen.getByRole('button', { name: 'Aplicar selecionados (0)' })).toBeDisabled();
  });

  test('"Rodar revisão agora" recalcula a prévia', async () => {
    let calls = 0;
    server.use(
      http.get(`${API_URL}/credit/review/preview`, () => {
        calls += 1;
        return HttpResponse.json({ data: calls === 1 ? [maria] : [maria, carlos] });
      }),
    );
    renderPage();

    await screen.findByText('Maria Oliveira');
    await userEvent.click(screen.getByRole('button', { name: 'Rodar revisão agora' }));
    expect(await screen.findByText('Carlos Souza')).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  test('erro da API ao aplicar aparece no diálogo', async () => {
    mockPreview([maria]);
    server.use(http.post(`${API_URL}/credit/review/apply`, () => HttpResponse.json({ message: 'Falha de teste.', code: 'X' }, { status: 409 })));
    renderPage();

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Selecionar Maria Oliveira' }));
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar selecionados (1)' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aplicar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha de teste.');
  });

  test('sem mudanças mostra o estado vazio', async () => {
    mockPreview([]);
    renderPage();

    expect(await screen.findByText('Nenhuma mudança proposta')).toBeInTheDocument();
  });

  test('no celular vira cartões com a seleção no cartão', async () => {
    setViewport(375, { pointer: 'coarse' });
    mockPreview();
    renderPage();

    await screen.findByText('Maria Oliveira');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Carlos Souza' }));
    expect(screen.getByRole('button', { name: 'Aplicar selecionados (1)' })).toBeEnabled();
  });
});
