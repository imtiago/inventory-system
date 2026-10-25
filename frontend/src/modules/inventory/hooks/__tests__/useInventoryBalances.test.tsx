import { describe, expect, test } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';

import { useInventoryBalances } from '../useInventoryBalances';
import { createTestQueryClient } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';

describe('useInventoryBalances', () => {
  test('ao trocar de página mantém loading até chegarem os saldos da nova página (sem "Sem estoque" falso)', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${API_URL}/inventory`, async ({ request }) => {
        const ids = new URL(request.url).searchParams.get('productVariantIds') ?? '';
        if (ids.includes('b')) await gate;
        return HttpResponse.json({ data: ids.split(',').map((id) => ({ productVariantId: id, quantity: 5, reserved: 0, available: 5 })) });
      }),
    );
    const client = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result, rerender } = renderHook(({ ids }) => useInventoryBalances(ids), { wrapper, initialProps: { ids: ['a'] } });
    await waitFor(() => expect(result.current.balances.get('a')).toBeDefined());
    expect(result.current.loading).toBe(false);

    rerender({ ids: ['b'] });
    expect(result.current.loading).toBe(true);
    expect(result.current.balances.get('b')).toBeUndefined();

    release();
    await waitFor(() => expect(result.current.balances.get('b')).toBeDefined());
    expect(result.current.loading).toBe(false);
  });
});
