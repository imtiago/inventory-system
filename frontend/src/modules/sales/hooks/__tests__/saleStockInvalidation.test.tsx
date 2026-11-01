import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';

import { useCreateSale } from '../useCreateSale';
import { useCancelSale } from '../useCancelSale';
import { createTestQueryClient } from '@/test/render';
import saleDetail from '@/test/fixtures/sales/saleDetail.json';
import { queryKeys } from '@/shared/react-query/keys';

function setup() {
  const queryClient = createTestQueryClient();
  const spy = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { spy, wrapper };
}

const invalidatedKeys = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey);

describe('estoque após venda', () => {
  test('criar venda invalida estoque (inventory) e lotes', async () => {
    const { spy, wrapper } = setup();
    const { result } = renderHook(() => useCreateSale(), { wrapper });

    result.current.mutate({
      customerId: saleDetail.data.customer.id,
      items: [{ productVariantId: 'v', quantity: 1 }],
      payment: { condition: 'CASH' },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const keys = invalidatedKeys(spy);
    expect(keys).toContainEqual(['inventory']);
    expect(keys).toContainEqual(['inventory-lots']);
  });

  test('venda no crediário invalida a ficha de crédito do cliente (disponível muda)', async () => {
    const { spy, wrapper } = setup();
    const { result } = renderHook(() => useCreateSale(), { wrapper });

    result.current.mutate({
      customerId: saleDetail.data.customer.id,
      items: [{ productVariantId: 'v', quantity: 1 }],
      payment: { condition: 'CREDIARIO', crediario: { installments: 2, downPayment: 0 } },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const keys = invalidatedKeys(spy);
    expect(keys).toContainEqual(queryKeys.customerCredit(saleDetail.data.customer.id));
    expect(keys).toContainEqual(queryKeys.sales);
    expect(keys).toContainEqual(queryKeys.receivables);
    expect(keys).toContainEqual(queryKeys.dashboard);
  });

  test('cancelar venda invalida estoque (inventory) e lotes', async () => {
    const { spy, wrapper } = setup();
    const { result } = renderHook(() => useCancelSale(saleDetail.data.id), { wrapper });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const keys = invalidatedKeys(spy);
    expect(keys).toContainEqual(['inventory']);
    expect(keys).toContainEqual(['inventory-lots']);
  });
});
