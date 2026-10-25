import { describe, expect, test } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';

import { VariantCreatePage } from '../VariantCreatePage';
import { VariantEditPage } from '../VariantEditPage';
import { createTestQueryClient, renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';

const variant = {
  id: 'v-1',
  name: 'Kaiak 100ml',
  code: 'KAI-1',
  barcode: null,
  productId: 'p-1',
  salePrice: 25,
};

function captureBody(method: 'post' | 'put', path: string) {
  const captured: { body?: unknown } = {};
  server.use(
    http[method](`${API_URL}${path}`, async ({ request }) => {
      captured.body = await request.json();
      return HttpResponse.json({ data: variant }, { status: method === 'post' ? 201 : 200 });
    }),
  );
  return captured;
}

function renderEdit() {
  server.use(http.get(`${API_URL}/variants/v-1`, () => HttpResponse.json({ data: variant })));
  return renderWithProviders(
    <Routes>
      <Route path="/variants/:variantId/edit" element={<VariantEditPage />} />
      <Route path="*" element={<div>destino</div>} />
    </Routes>,
    { route: '/variants/v-1/edit' },
  );
}

describe('Variant pages', () => {
  test('criar com barcode em branco omite o barcode e envia salePrice numérico', async () => {
    const captured = captureBody('post', '/products/p-1/variants');
    renderWithProviders(
      <Routes>
        <Route path="/products/:id/variants/new" element={<VariantCreatePage />} />
        <Route path="*" element={<div>destino</div>} />
      </Routes>,
      { route: '/products/p-1/variants/new' },
    );

    await userEvent.type(screen.getByPlaceholderText('Ex: Kaiak 100ml'), 'Kaiak 100ml');
    await userEvent.type(screen.getByPlaceholderText('EAN'), '   ');
    await userEvent.type(screen.getByLabelText('Preço de venda (R$)'), '39.9');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Variante' }));

    await waitFor(() => expect(captured.body).toBeDefined());
    const body = captured.body as Record<string, unknown>;
    expect(body.name).toBe('Kaiak 100ml');
    expect(body.salePrice).toBe(39.9);
    expect(body.barcode ?? null).toBeNull();
  });

  test('editar variante sem barcode envia barcode null e salePrice numérico', async () => {
    const captured = captureBody('put', '/variants/v-1');
    renderEdit();

    const price = await screen.findByLabelText('Preço de venda (R$)');
    await userEvent.clear(price);
    await userEvent.type(price, '30');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }));

    await waitFor(() => expect(captured.body).toBeDefined());
    expect(captured.body).toMatchObject({ name: 'Kaiak 100ml', barcode: null, salePrice: 30 });
  });

  test('editar exige o preço de venda', async () => {
    const captured = captureBody('put', '/variants/v-1');
    renderEdit();

    const price = await screen.findByLabelText('Preço de venda (R$)');
    await userEvent.clear(price);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }));

    expect(await screen.findByText('Informe o preço de venda.')).toBeInTheDocument();
    expect(captured.body).toBeUndefined();
  });

  test('reabrir a edição após salvar mostra o preço novo e não reverte o preço ao mudar só o nome', async () => {
    let current = { ...variant };
    const puts: Record<string, unknown>[] = [];
    server.use(
      http.get(`${API_URL}/variants/v-1`, () => HttpResponse.json({ data: current })),
      http.put(`${API_URL}/variants/v-1`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        puts.push(body);
        current = { ...current, ...body } as typeof current;
        return HttpResponse.json({ data: current });
      }),
    );
    const queryClient = createTestQueryClient();
    const tree = (
      <Routes>
        <Route path="/variants/:variantId/edit" element={<VariantEditPage />} />
        <Route path="*" element={<div>destino</div>} />
      </Routes>
    );

    const first = renderWithProviders(tree, { route: '/variants/v-1/edit', queryClient });
    const price = await screen.findByLabelText('Preço de venda (R$)');
    await userEvent.clear(price);
    await userEvent.type(price, '12');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }));
    await screen.findByText('destino');
    first.unmount();

    renderWithProviders(tree, { route: '/variants/v-1/edit', queryClient });
    expect(await screen.findByLabelText('Preço de venda (R$)')).toHaveValue('12');
    const name = screen.getByPlaceholderText('Ex: Kaiak 100ml');
    await userEvent.clear(name);
    await userEvent.type(name, 'Novo nome');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }));

    await waitFor(() => expect(puts).toHaveLength(2));
    expect(puts[1]).toMatchObject({ name: 'Novo nome', salePrice: 12 });
  });
});
