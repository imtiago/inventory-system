import type { ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { toast } from 'sonner';

import { useCrudMutation } from '../useCrudMutation';
import { createTestQueryClient } from '@/test/render';
import conflict from '@/test/fixtures/errors/conflict.json';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

function axiosError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response = { status, data, statusText: '', headers: {}, config } as AxiosResponse;
  return new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, response);
}

function run(error: unknown) {
  const client = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

  const { result } = renderHook(
    () => useCrudMutation({ mutationFn: async () => { throw error; }, errorMessage: 'Falha padrão.' }),
    { wrapper },
  );

  result.current.mutate(undefined);

  return result;
}

describe('useCrudMutation', () => {
  beforeEach(() => vi.clearAllMocks());

  test('mostra toast com a mensagem do backend', async () => {
    run(axiosError(409, conflict));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Código de barras já cadastrado.'));
  });

  test('usa a mensagem padrão quando o erro é desconhecido', async () => {
    run(new Error('boom'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Falha padrão.'));
  });

  test('não mostra toast em 401', async () => {
    const result = run(axiosError(401, { message: 'Token inválido.', code: 'UNAUTHENTICATED' }));

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(toast.error).not.toHaveBeenCalled();
  });
});
