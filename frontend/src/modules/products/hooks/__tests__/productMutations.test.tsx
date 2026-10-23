import type { ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';

import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { createTestQueryClient } from '@/test/render';
import { useDeleteProduct } from '../useDeleteProduct';
import { useUpdateProduct } from '../useUpdateProduct';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>
);

const PRODUCT = { id: 'p-1', input: { name: 'x' } };

describe('useDeleteProduct / useUpdateProduct', () => {
  beforeEach(() => vi.clearAllMocks());

  test('delete 409 mostra a mensagem do backend', async () => {
    server.use(http.delete(`${API_URL}/products/:id`, () => HttpResponse.json({ message: 'Produto possui variantes.', code: 'CONFLICT' }, { status: 409 })));
    const { result } = renderHook(() => useDeleteProduct(), { wrapper });
    result.current.mutate('p-1');
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Produto possui variantes.'));
  });

  test('delete 422 mostra a mensagem do backend', async () => {
    server.use(http.delete(`${API_URL}/products/:id`, () => HttpResponse.json({ message: 'Produto com estoque.', code: 'BUSINESS_RULE' }, { status: 422 })));
    const { result } = renderHook(() => useDeleteProduct(), { wrapper });
    result.current.mutate('p-1');
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Produto com estoque.'));
  });

  test('delete 401 não mostra toast', async () => {
    server.use(http.delete(`${API_URL}/products/:id`, () => HttpResponse.json({ message: 'Token inválido.', code: 'UNAUTHENTICATED' }, { status: 401 })));
    const { result } = renderHook(() => useDeleteProduct(), { wrapper });
    result.current.mutate('p-1');
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
  });

  test('update 409 mostra a mensagem do backend', async () => {
    server.use(http.put(`${API_URL}/products/:id`, () => HttpResponse.json({ message: 'Código já cadastrado.', code: 'CONFLICT' }, { status: 409 })));
    const { result } = renderHook(() => useUpdateProduct(), { wrapper });
    result.current.mutate(PRODUCT);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Código já cadastrado.'));
  });

  test('update 401 não mostra toast', async () => {
    server.use(http.put(`${API_URL}/products/:id`, () => HttpResponse.json({ message: 'Token inválido.', code: 'UNAUTHENTICATED' }, { status: 401 })));
    const { result } = renderHook(() => useUpdateProduct(), { wrapper });
    result.current.mutate(PRODUCT);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
