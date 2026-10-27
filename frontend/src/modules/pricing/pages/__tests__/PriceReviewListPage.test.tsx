import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/shared/react-query/keys';
import { API_URL } from '@/test/handlers/inventory';
import reviews from '@/test/fixtures/pricing/priceReviews.json';
import { createTestQueryClient, renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { resetViewport, setViewport } from '@/test/viewport';

import { PriceReviewListPage } from '../PriceReviewListPage';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const [first, second] = reviews.data;

function serve(body: object = reviews) {
  server.use(http.get(`${API_URL}/pricing/reviews`, () => HttpResponse.json(body)));
}

describe('PriceReviewListPage', () => {
  it('lista atual, sugerido, diferença e motivo em pt-BR', async () => {
    serve();
    renderWithProviders(<PriceReviewListPage />);

    const row = (await screen.findByText(first.label)).closest('tr') as HTMLElement;
    expect(row).toHaveTextContent('R$ 30,00');
    expect(row).toHaveTextContent('R$ 24,90');
    expect(row).toHaveTextContent('-R$ 5,10');
    expect(row).toHaveTextContent('Custo mudou');
    expect(screen.getByText(second.label).closest('tr')).toHaveTextContent('Margem abaixo da desejada');
  });

  it('Editar leva à edição da variante', async () => {
    serve();
    renderWithProviders(<PriceReviewListPage />);

    const link = await screen.findByRole('link', { name: `Editar ${first.label}` });
    expect(link).toHaveAttribute('href', `/variants/${first.productVariantId}/edit`);
  });

  it('"Aplicar sugerido (n)" começa desabilitado e aplica as selecionadas (com ignoradas)', async () => {
    serve();
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API_URL}/pricing/reviews/apply`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: { applied: [first.id], skipped: [second.id] } });
      }),
    );
    const queryClient = createTestQueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    renderWithProviders(<PriceReviewListPage />, { queryClient });

    const apply = await screen.findByRole('button', { name: /Aplicar sugerido \(0\)/ });
    expect(apply).toBeDisabled();

    await userEvent.click(await screen.findByLabelText(`Selecionar ${first.label}`));
    await userEvent.click(screen.getByLabelText(`Selecionar ${second.label}`));
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar sugerido (2)' }));

    await waitFor(() => expect(bodies).toEqual([{ ids: [first.id, second.id] }]));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('1 preço aplicado.'));
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('1 item ignorado'));
    const keys = spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);
    expect(keys).toEqual(expect.arrayContaining([queryKeys.products, queryKeys.priceReviews, queryKeys.dashboard, ['pricing', 'variants']]));
    expect(screen.getByRole('button', { name: /Aplicar sugerido \(0\)/ })).toBeDisabled();
  });

  it('Selecionar todas marca as linhas da página', async () => {
    serve();
    renderWithProviders(<PriceReviewListPage />);

    await userEvent.click(await screen.findByLabelText('Selecionar todas'));
    expect(screen.getByRole('button', { name: 'Aplicar sugerido (2)' })).toBeEnabled();
    await userEvent.click(screen.getByLabelText('Selecionar todas'));
    expect(screen.getByRole('button', { name: /Aplicar sugerido \(0\)/ })).toBeDisabled();
  });

  it('Aplicar numa linha envia só aquele id', async () => {
    serve();
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API_URL}/pricing/reviews/apply`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: { applied: [second.id], skipped: [] } });
      }),
    );
    renderWithProviders(<PriceReviewListPage />);

    await userEvent.click(await screen.findByRole('button', { name: `Aplicar sugerido: ${second.label}` }));
    await waitFor(() => expect(bodies).toEqual([{ ids: [second.id] }]));
  });

  it('Manter dispensa a revisão e atualiza a lista', async () => {
    serve();
    const dismissed: string[] = [];
    server.use(
      http.post(`${API_URL}/pricing/reviews/:id/dismiss`, ({ params }) => {
        dismissed.push(String(params.id));
        return HttpResponse.json({ data: { id: params.id, status: 'DISMISSED' } });
      }),
    );
    const queryClient = createTestQueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    renderWithProviders(<PriceReviewListPage />, { queryClient });

    await userEvent.click(await screen.findByRole('button', { name: `Manter preço: ${first.label}` }));

    await waitFor(() => expect(dismissed).toEqual([first.id]));
    await waitFor(() => expect(spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey)).toEqual(expect.arrayContaining([queryKeys.priceReviews, queryKeys.dashboard])));
  });

  it('lista vazia mostra mensagem', async () => {
    serve({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } });
    renderWithProviders(<PriceReviewListPage />);

    expect(await screen.findByText('Nenhum preço para revisar')).toBeInTheDocument();
  });

  it('celular: cartões com checkbox e ações no menu', async () => {
    setViewport(375, { pointer: 'coarse' });
    serve();
    renderWithProviders(<PriceReviewListPage />);

    const cards = await screen.findAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(within(cards[0]).getByLabelText(`Selecionar ${first.label}`)).toBeInTheDocument();
    expect(within(cards[0]).getByText('R$ 24,90')).toBeInTheDocument();
    await userEvent.click(within(cards[0]).getByRole('button', { name: /Mais ações/ }));
    expect(within(cards[0]).getByRole('button', { name: `Manter preço: ${first.label}` })).toBeInTheDocument();
    resetViewport();
  });
});
