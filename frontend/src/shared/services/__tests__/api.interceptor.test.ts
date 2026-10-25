import { afterEach, describe, expect, test, vi } from 'vitest';
import { http, HttpResponse } from 'msw';

import { toast } from 'sonner';

import { api } from '../api';
import { queryClient } from '@/shared/react-query/queryClient';
import { useAuthStore } from '@/shared/store/auth';
import { resetSession } from '@/test/auth';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';

const unauthorized = () => HttpResponse.json({ message: 'x', code: 'UNAUTHORIZED' }, { status: 401 });

afterEach(() => vi.restoreAllMocks());

describe('api 401 interceptor', () => {
  test('401 em /auth/login não limpa sessão nem cache', async () => {
    server.use(http.post(`${API_URL}/auth/login`, unauthorized));
    const clear = vi.spyOn(queryClient, 'clear');

    await expect(api.post('/auth/login', {})).rejects.toBeTruthy();

    expect(clear).not.toHaveBeenCalled();
    expect(useAuthStore.getState().token).toBe('token-ADMIN');
    expect(useAuthStore.getState().user).not.toBeNull();
    expect(useAuthStore.getState().sessionExpired).toBe(false);
  });

  test('401 em outra rota encerra a sessão como expirada e limpa o cache do app', async () => {
    server.use(http.get(`${API_URL}/sales`, unauthorized));
    const clear = vi.spyOn(queryClient, 'clear');
    queryClient.setQueryData(['sales'], { secret: 1 });

    await expect(api.get('/sales')).rejects.toBeTruthy();

    expect(clear).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(['sales'])).toBeUndefined();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().sessionExpired).toBe(true);
  });

  test('401 de requisição feita com o token antigo não derruba a sessão com o token novo', async () => {
    let release: () => void = () => {};
    let arrived: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const reached = new Promise<void>((resolve) => { arrived = resolve; });
    server.use(http.get(`${API_URL}/sales`, async () => { arrived(); await gate; return unauthorized(); }));
    const clear = vi.spyOn(queryClient, 'clear');

    const pending = api.get('/sales');
    await reached; // a requisição já saiu com o token antigo
    useAuthStore.getState().setToken('token-novo');
    release();
    await expect(pending).rejects.toBeTruthy();

    expect(clear).not.toHaveBeenCalled();
    expect(useAuthStore.getState().token).toBe('token-novo');
    expect(useAuthStore.getState().sessionExpired).toBe(false);
  });

  test('401 tardio após logout voluntário não marca sessão expirada', async () => {
    server.use(http.get(`${API_URL}/sales`, unauthorized));
    const pending = api.get('/sales');
    resetSession(); // voluntary logout while the request is in flight

    await expect(pending).rejects.toBeTruthy();

    expect(useAuthStore.getState().sessionExpired).toBe(false);
  });
});

describe('api 403 interceptor', () => {
  const forbidden = () => HttpResponse.json({ message: 'x', code: 'FORBIDDEN' }, { status: 403 });

  test('403 mostra o aviso uma única vez numa rajada e revalida /users/me com o novo papel', async () => {
    let meCalls = 0;
    server.use(
      http.get(`${API_URL}/sales`, forbidden),
      http.get(`${API_URL}/users/me`, () => {
        meCalls++;
        return HttpResponse.json({ data: { id: 'u', name: 'U', email: 'u@x.com', role: 'VENDEDOR' } });
      }),
    );
    const error = vi.spyOn(toast, 'error').mockImplementation(() => '');

    await Promise.allSettled([api.get('/sales'), api.get('/sales'), api.get('/sales')]);
    await vi.waitFor(() => expect(useAuthStore.getState().user?.role).toBe('VENDEDOR'));

    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('Você não tem permissão para esta ação.', expect.anything());
    expect(meCalls).toBeGreaterThanOrEqual(1);
    expect(useAuthStore.getState().token).toBe('token-ADMIN');
  });
});

describe('auth store cache handling', () => {
  test('setSession limpa o cache; setToken não', () => {
    queryClient.setQueryData(['x'], 1);
    useAuthStore.getState().setToken('token-novo');
    expect(queryClient.getQueryData(['x'])).toBe(1);
    useAuthStore.getState().setSession('token-ADMIN', { id: '1', name: 'A', email: 'a@x.com', role: 'ADMIN' });
    expect(queryClient.getQueryData(['x'])).toBeUndefined();
  });
});
