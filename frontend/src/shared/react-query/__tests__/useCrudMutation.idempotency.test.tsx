import type { ReactNode } from 'react';
import { describe, expect, test } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { useCrudMutation } from '../useCrudMutation';
import { api } from '@/shared/services/api';
import { idempotencyConfig } from '@/shared/utils/idempotencyKey';
import { createTestQueryClient } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';

const keys: Array<string | null> = [];
let mode: 'ok' | 'network' | '500' | '422' | '409' = 'ok';

function setup() {
  keys.length = 0;
  mode = 'ok';
  server.use(
    http.post(`${API_URL}/sales`, ({ request }) => {
      keys.push(request.headers.get('Idempotency-Key'));
      if (mode === 'network') return HttpResponse.error();
      if (mode === '500') return HttpResponse.json({ code: 'INTERNAL', message: 'x' }, { status: 500 });
      if (mode === '409') return HttpResponse.json({ code: 'CONFLICT', message: 'x' }, { status: 409 });
      if (mode === '422') return HttpResponse.json({ code: 'IDEMPOTENCY_KEY_REUSED', message: 'Esta chave já foi usada em outra operação.' }, { status: 422 });
      return HttpResponse.json({ data: {} }, { status: 201 });
    }),
  );
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

  return renderHook(
    () =>
      useCrudMutation({
        idempotent: true,
        silentError: true,
        mutationFn: async (data: { n: number }, key: string) => (await api.post('/sales', data, idempotencyConfig(key))).data,
      }),
    { wrapper },
  ).result;
}

async function submit(result: ReturnType<typeof setup>, n: number) {
  await act(async () => {
    await result.current.mutateAsync({ n }).catch(() => undefined);
  });
  await waitFor(() => expect(result.current.isPending).toBe(false));
}

describe('useCrudMutation idempotent', () => {
  test('mutação coberta envia Idempotency-Key', async () => {
    const result = setup();
    await submit(result, 1);
    expect(keys[0]).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
  });

  test('erro de rede e nova tentativa com os mesmos dados mantém a mesma chave', async () => {
    const result = setup();
    mode = 'network';
    await submit(result, 1);
    await submit(result, 1);
    mode = '500';
    await submit(result, 1);
    expect(new Set(keys).size).toBe(1);
    expect(keys).toHaveLength(3);
  });

  test('após sucesso a próxima ação usa chave nova', async () => {
    const result = setup();
    mode = 'network';
    await submit(result, 1);
    mode = 'ok';
    await submit(result, 1);
    await submit(result, 1);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  test('dados diferentes usam chave nova', async () => {
    const result = setup();
    mode = 'network';
    await submit(result, 1);
    await submit(result, 2);
    expect(keys[1]).not.toBe(keys[0]);
  });

  test('409 (operação anterior ainda em andamento) e outros erros mantêm a chave com os mesmos dados', async () => {
    const result = setup();
    mode = '409';
    await submit(result, 1);
    await submit(result, 1);
    mode = 'ok';
    await submit(result, 1);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).toBe(keys[0]);
  });

  test('422 IDEMPOTENCY_KEY_REUSED renova a chave', async () => {
    const result = setup();
    mode = '422';
    await submit(result, 1);
    mode = 'ok';
    await submit(result, 1);
    expect(keys[1]).not.toBe(keys[0]);
  });
});
