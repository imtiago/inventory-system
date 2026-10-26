import { describe, expect, test } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';

import { useInventoryBox } from '../useInventoryBox';
import { createTestQueryClient } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import inventoryBox from '@/test/fixtures/inventory/inventoryBox.json';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('useInventoryBox.createBox', () => {
  test('envia Idempotency-Key; repete a mesma chave após falha e renova após sucesso', async () => {
    const keys: (string | null)[] = [];
    let fail = true;
    server.use(
      http.post(`${API_URL}/inventory/boxes`, ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        if (fail) return HttpResponse.json({ message: 'Falhou.', code: 'X' }, { status: 500 });
        return HttpResponse.json(inventoryBox, { status: 201 });
      }),
    );
    const { result } = renderHook(() => useInventoryBox(), { wrapper });

    await act(async () => { await result.current.createBox(); });
    fail = false;
    await act(async () => { await result.current.createBox(); });
    await waitFor(() => expect(keys).toHaveLength(2));
    await act(async () => { await result.current.createBox(); });

    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).toBeTruthy();
    expect(keys[2]).not.toBe(keys[0]);
  });
});
