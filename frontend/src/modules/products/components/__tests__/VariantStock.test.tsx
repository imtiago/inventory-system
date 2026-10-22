import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';

import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { renderWithProviders } from '@/test/render';
import { VariantStock } from '../VariantStock';

describe('VariantStock', () => {
  test('VariantStock mostra disponível', async () => {
    renderWithProviders(<VariantStock variantId="a3d9e2f1-7c4b-4e8a-b5d6-1f2e3c4d5a60" />);
    expect(await screen.findByText('40')).toBeInTheDocument();
    expect(screen.getByText('Disp.')).toBeInTheDocument();
  });

  test("VariantStock sem inventário mostra 'Sem estoque'", async () => {
    server.use(
      http.get(`${API_URL}/inventory/variants/:variantId`, () =>
        HttpResponse.json({ message: 'not found' }, { status: 404 }),
      ),
    );
    renderWithProviders(<VariantStock variantId="x" />);
    expect(await screen.findByText('Sem estoque')).toBeInTheDocument();
  });
});
