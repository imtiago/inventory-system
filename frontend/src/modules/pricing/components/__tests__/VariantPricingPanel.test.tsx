import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { VariantEditPage } from '@/modules/products/pages/VariantEditPage';
import { loginAs } from '@/test/auth';
import fixture from '@/test/fixtures/pricing/variantPricing.json';
import { API_URL } from '@/test/handlers/inventory';
import { createTestQueryClient, renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { resetViewport, setViewport } from '@/test/viewport';
import { queryKeys } from '@/shared/react-query/keys';

import { VariantPricingPanel } from '../VariantPricingPanel';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const VARIANT = fixture.data.variantId;

function simulations() {
  const rows: object[] = [{ condition: 'CASH', installments: 1, passOn: false, price: 20.9, margin: { amount: 6.72, percent: 32.15 } }];
  const card = (condition: string, n: number) => {
    rows.push({ condition, installments: n, passOn: false, price: 20.9, margin: { amount: 5.5, percent: 26.3 } });
    rows.push({ condition, installments: n, passOn: true, price: 21.6, margin: { amount: 6.4, percent: 29.6 } });
  };
  card('DEBIT', 1);
  for (let n = 1; n <= 12; n++) card('CREDIT', n);
  return rows;
}

function serve(overrides: Record<string, unknown> = {}) {
  const data = { ...fixture.data, simulations: simulations(), ...overrides };
  server.use(http.get(`${API_URL}/pricing/variants/${VARIANT}`, () => HttpResponse.json({ data })));
}

function field(label: string) {
  return screen.getByText(label).closest('div') as HTMLElement;
}

describe('VariantPricingPanel', () => {
  it('mostra a composição do preço em pt-BR', async () => {
    serve();
    renderWithProviders(<VariantPricingPanel variantId={VARIANT} />);

    await screen.findByText('Composição do preço');
    expect(field('Custo médio')).toHaveTextContent('R$ 10,00');
    expect(field('Despesas da venda')).toHaveTextContent('R$ 4,18');
    expect(field('Despesas da venda')).toHaveTextContent('20,00%');
    expect(field('Margem desejada')).toHaveTextContent('30,00%');
    expect(field('Margem desejada')).toHaveTextContent('categoria');
    expect(field('Preço sugerido')).toHaveTextContent('R$ 20,90');
    expect(field('Preço praticado')).toHaveTextContent('R$ 20,90');
    expect(field('Margem real')).toHaveTextContent('R$ 6,72');
    expect(field('Margem real')).toHaveTextContent('32,15%');
    expect(field('Preço da revista')).toHaveTextContent('R$ 25,00');
    expect(field('Margem pela revista')).toHaveTextContent('R$ 10,00');
    expect(field('Margem pela revista')).toHaveTextContent('40,00%');
  });

  it('custo com 4 casas aparece inteiro', async () => {
    serve({ averageCost: 10.1234 });
    renderWithProviders(<VariantPricingPanel variantId={VARIANT} />);

    await screen.findByText('Composição do preço');
    expect(field('Custo médio')).toHaveTextContent('R$ 10,1234');
  });

  it('sem sugestão nem revista os dois botões ficam desabilitados', async () => {
    serve({ suggestedPrice: null, supplierSuggestedPrice: null, supplierSuggestedPriceUpdatedAt: null, supplierMargin: null });
    renderWithProviders(<VariantPricingPanel variantId={VARIANT} />);

    expect(await screen.findByRole('button', { name: 'Aplicar sugerido' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Usar preço da revista' })).toBeDisabled();
    expect(field('Preço sugerido')).toHaveTextContent('—');
  });

  it('Aplicar sugerido envia a origem e invalida produtos, composição, revisões e dashboard', async () => {
    serve();
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API_URL}/pricing/variants/${VARIANT}/apply-price`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: { ...fixture.data, simulations: simulations() } });
      }),
    );
    const queryClient = createTestQueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    renderWithProviders(<VariantPricingPanel variantId={VARIANT} />, { queryClient });

    await userEvent.click(await screen.findByRole('button', { name: 'Aplicar sugerido' }));

    await waitFor(() => expect(bodies).toEqual([{ source: 'SUGGESTED' }]));
    await waitFor(() => {
      const keys = spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);
      expect(keys).toEqual(expect.arrayContaining([queryKeys.products, queryKeys.variantPricing(VARIANT), queryKeys.priceReviews, queryKeys.dashboard]));
    });
  });

  it('Usar preço da revista envia SUPPLIER', async () => {
    serve();
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API_URL}/pricing/variants/${VARIANT}/apply-price`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: fixture.data });
      }),
    );
    renderWithProviders(<VariantPricingPanel variantId={VARIANT} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Usar preço da revista' }));
    await waitFor(() => expect(bodies).toEqual([{ source: 'SUPPLIER' }]));
  });

  it('salva o preço da revista (reais) e permite limpar', async () => {
    serve();
    const bodies: unknown[] = [];
    server.use(
      http.put(`${API_URL}/pricing/variants/${VARIANT}/supplier-price`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: fixture.data });
      }),
    );
    renderWithProviders(<VariantPricingPanel variantId={VARIANT} />);

    const input = await screen.findByLabelText('Novo preço da revista');
    await userEvent.type(input, '27,5');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar preço da revista' }));
    await waitFor(() => expect(bodies).toEqual([{ supplierSuggestedPrice: 27.5 }]));

    await userEvent.click(screen.getByRole('button', { name: 'Remover preço da revista' }));
    await waitFor(() => expect(bodies[1]).toEqual({ supplierSuggestedPrice: null }));
  });

  it('erro ao carregar mostra aviso', async () => {
    server.use(http.get(`${API_URL}/pricing/variants/${VARIANT}`, () => HttpResponse.json({ message: 'x' }, { status: 500 })));
    renderWithProviders(<VariantPricingPanel variantId={VARIANT} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar a composição do preço');
  });
});

describe('PaymentSimulator (no painel)', () => {
  it('desktop: tabela com à vista, débito e crédito 1x a 12x', async () => {
    serve();
    renderWithProviders(<VariantPricingPanel variantId={VARIANT} />);

    await screen.findByText('Simulador por forma de pagamento');
    const table = screen.getByRole('table', { name: 'Simulador por forma de pagamento' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(14);
    expect(within(rows[0]).getByText('À vista')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Débito')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Crédito 1x')).toBeInTheDocument();
    expect(within(rows[13]).getByText('Crédito 12x')).toBeInTheDocument();
    expect(rows[2]).toHaveTextContent('R$ 21,60');
    expect(rows[2]).toHaveTextContent('R$ 6,40 (29,60%)');
    expect(rows[2]).toHaveTextContent('R$ 5,50 (26,30%)');
  });

  it('celular: vira cartões', async () => {
    setViewport(375, { pointer: 'coarse' });
    serve();
    renderWithProviders(<VariantPricingPanel variantId={VARIANT} />);

    await screen.findByText('Simulador por forma de pagamento');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(14);
    expect(within(cards[13]).getByText('Crédito 12x')).toBeInTheDocument();
    resetViewport();
  });
});

describe('VariantEditPage', () => {
  const variant = { id: VARIANT, name: 'Kaiak', code: 'K1', barcode: null, productId: 'p-1', salePrice: 20.9 };

  function renderEdit() {
    server.use(http.get(`${API_URL}/variants/${VARIANT}`, () => HttpResponse.json({ data: variant })));
    return renderWithProviders(
      <Routes>
        <Route path="/variants/:variantId/edit" element={<VariantEditPage />} />
      </Routes>,
      { route: `/variants/${VARIANT}/edit` },
    );
  }

  it('ADMIN (catalog.price) vê o painel', async () => {
    serve();
    renderEdit();

    expect(await screen.findByText('Composição do preço')).toBeInTheDocument();
  });

  it('VENDEDOR não vê o painel nem busca a composição', async () => {
    loginAs('VENDEDOR');
    const calls: string[] = [];
    server.use(http.get(`${API_URL}/pricing/variants/:id`, ({ request }) => { calls.push(request.url); return HttpResponse.json(fixture); }));
    renderEdit();

    await screen.findByLabelText('Preço de venda (R$)');
    expect(screen.queryByText('Composição do preço')).not.toBeInTheDocument();
    expect(calls).toEqual([]);
  });
});
