import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { useCancelSale } from '@/modules/sales/hooks/useCancelSale';
import { useCreateSale } from '@/modules/sales/hooks/useCreateSale';
import { useCancelPurchase, useCreatePurchase, useReceivePurchase } from '@/modules/purchases/hooks/usePurchases';
import { useUpdateSupplier } from '@/modules/suppliers/hooks/useSupplierMutations';
import { useRegisterPayment } from '../useRegisterPayment';
import { useReversePayment } from '../useReversePayment';
import { createTestQueryClient } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { queryKeys } from '@/shared/react-query/keys';
import saleDetail from '@/test/fixtures/sales/saleDetail.json';
import receivableDetail from '@/test/fixtures/finance/receivableDetail.json';
import payableDetail from '@/test/fixtures/finance/payableDetail.json';
import purchaseDetail from '@/test/fixtures/purchases/purchaseDetail.json';

function setup() {
  const queryClient = createTestQueryClient();
  const spy = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const keys = () => spy.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey);
  return { wrapper, keys };
}

describe('invalidação entre módulos', () => {
  test('criar venda invalida recebíveis e dashboard', async () => {
    const { wrapper, keys } = setup();
    const { result } = renderHook(() => useCreateSale(), { wrapper });
    result.current.mutate({ customerId: 'c', items: [{ productVariantId: 'v', quantity: 1 }], paymentTerms: { installments: 1 } } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(keys()).toContainEqual(queryKeys.receivables);
    expect(keys()).toContainEqual(queryKeys.dashboard);
  });

  test('cancelar venda invalida recebíveis e dashboard', async () => {
    const { wrapper, keys } = setup();
    const { result } = renderHook(() => useCancelSale(saleDetail.data.id), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(keys()).toContainEqual(queryKeys.receivables);
    expect(keys()).toContainEqual(queryKeys.dashboard);
  });

  test('criar pedido de compra invalida contas a pagar e dashboard', async () => {
    const { wrapper, keys } = setup();
    const { result } = renderHook(() => useCreatePurchase(), { wrapper });
    result.current.mutate({} as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(keys()).toContainEqual(queryKeys.payables);
    expect(keys()).toContainEqual(queryKeys.dashboard);
  });

  test('receber pedido invalida contas a pagar e dashboard', async () => {
    const { wrapper, keys } = setup();
    const { result } = renderHook(() => useReceivePurchase(purchaseDetail.data.id), { wrapper });
    result.current.mutate({ items: [] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(keys()).toContainEqual(queryKeys.payables);
    expect(keys()).toContainEqual(queryKeys.dashboard);
  });

  test('cancelar pedido invalida contas a pagar e dashboard', async () => {
    const { wrapper, keys } = setup();
    const { result } = renderHook(() => useCancelPurchase(purchaseDetail.data.id), { wrapper });
    result.current.mutate('motivo');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(keys()).toContainEqual(queryKeys.payables);
    expect(keys()).toContainEqual(queryKeys.dashboard);
  });

  test('pagar e estornar invalidam o dashboard', async () => {
    server.use(
      http.post(`${API_URL}/payables/:id/parcels/:parcelId/payments`, () => HttpResponse.json(payableDetail, { status: 201 })),
      http.post(`${API_URL}/receivables/payments/:id/reverse`, () => HttpResponse.json(receivableDetail)),
    );
    const pay = setup();
    const paid = renderHook(() => useRegisterPayment('payable', payableDetail.data.id), { wrapper: pay.wrapper });
    paid.result.current.mutate({ parcelId: 'p', input: { amount: 1, method: 'PIX', paymentDate: '2026-10-25' } });
    await waitFor(() => expect(paid.result.current.isSuccess).toBe(true));
    expect(pay.keys()).toContainEqual(queryKeys.dashboard);

    const rev = setup();
    const reversed = renderHook(() => useReversePayment('receivable', receivableDetail.data.id), { wrapper: rev.wrapper });
    reversed.result.current.mutate({ paymentId: 'x', reason: 'erro' });
    await waitFor(() => expect(reversed.result.current.isSuccess).toBe(true));
    expect(rev.keys()).toContainEqual(queryKeys.dashboard);
  });

  test('alterar fornecedor invalida contas a pagar e importações de NF-e', async () => {
    const { wrapper, keys } = setup();
    const { result } = renderHook(() => useUpdateSupplier('s-1'), { wrapper });
    result.current.mutate({ name: 'Novo nome' } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(keys()).toContainEqual(queryKeys.payables);
    expect(keys()).toContainEqual(queryKeys.nfeImports);
  });
});
