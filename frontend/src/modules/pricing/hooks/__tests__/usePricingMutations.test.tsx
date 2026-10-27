import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';

import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { createTestQueryClient } from '@/test/render';
import { queryKeys } from '@/shared/react-query/keys';

import { useCreateExpense, useSavePricingSettings, useSetTargetMargin } from '../usePricingMutations';

function setup() {
  const client = createTestQueryClient();
  const spy = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { spy, wrapper };
}

const invalidatedKeys = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));

describe('mutações de preço invalidam o lucro estimado', () => {
  test.each([
    ['configurações', () => useSavePricingSettings(), () => http.put(`${API_URL}/pricing/settings`, () => HttpResponse.json({ data: {} })), {}],
    ['despesa', () => useCreateExpense(), () => http.post(`${API_URL}/pricing/expenses`, () => HttpResponse.json({ data: {} }, { status: 201 })), { name: 'x', percent: 1 }],
    ['margem-alvo', () => useSetTargetMargin(), () => http.put(`${API_URL}/pricing/target-margins/:level/:id`, () => HttpResponse.json({ data: {} })), { level: 'category', id: 'c1', percent: 10 }],
  ] as const)('%s: relatório de lucro e painel', async (_name, hook, handler, variables) => {
    server.use(handler());
    const { spy, wrapper } = setup();
    const { result } = renderHook(() => hook() as { mutate: (v: unknown) => void; isSuccess: boolean }, { wrapper });
    act(() => result.current.mutate(variables));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => {
      const keys = invalidatedKeys(spy);
      expect(keys).toContain(JSON.stringify(['reports', 'profit']));
      expect(keys).toContain(JSON.stringify(queryKeys.dashboard));
    });
  });
});
