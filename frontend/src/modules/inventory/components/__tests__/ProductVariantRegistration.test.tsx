import { describe, expect, test, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { ProductVariantRegistration } from '../ProductVariantRegistration';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';

const created = { id: 'v-9', name: 'Kaiak 100ml', code: 'K-9', barcode: '789', productId: 'p-1', salePrice: 39.9 };

function setup() {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(`${API_URL}/products/p-1/variants`, async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ data: created }, { status: 201 });
    }),
  );
  const onSuccess = vi.fn();
  renderWithProviders(<ProductVariantRegistration barcode="789" productId="p-1" productName="Kaiak" onSuccess={onSuccess} onCancel={() => {}} />);
  return { bodies, onSuccess };
}

describe('ProductVariantRegistration', () => {
  test('exige o preço de venda e não envia sem ele', async () => {
    const { bodies } = setup();

    await userEvent.type(screen.getByLabelText('Nome da variante'), 'Kaiak 100ml');
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar variante' }));

    expect(await screen.findByText('Informe o preço de venda.')).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  test('envia nome, barcode e salePrice numérico pelo serviço compartilhado', async () => {
    const { bodies, onSuccess } = setup();

    await userEvent.type(screen.getByLabelText('Nome da variante'), 'Kaiak 100ml');
    await userEvent.type(screen.getByLabelText('Preço de venda (R$)'), '39.9');
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar variante' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(created));
    expect(bodies).toEqual([{ name: 'Kaiak 100ml', barcode: '789', salePrice: 39.9 }]);
  });

  test('dois cliques enviam uma única requisição', async () => {
    const { bodies, onSuccess } = setup();

    await userEvent.type(screen.getByLabelText('Nome da variante'), 'Kaiak 100ml');
    await userEvent.type(screen.getByLabelText('Preço de venda (R$)'), '10');
    await userEvent.dblClick(screen.getByRole('button', { name: 'Cadastrar variante' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(bodies).toHaveLength(1);
  });
});
