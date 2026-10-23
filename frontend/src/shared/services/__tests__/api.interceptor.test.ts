import { afterEach, describe, expect, test, vi } from 'vitest';
import { http, HttpResponse } from 'msw';

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

  test('401 tardio após logout voluntário não marca sessão expirada', async () => {
    server.use(http.get(`${API_URL}/sales`, unauthorized));
    const pending = api.get('/sales');
    resetSession(); // voluntary logout while the request is in flight

    await expect(pending).rejects.toBeTruthy();

    expect(useAuthStore.getState().sessionExpired).toBe(false);
  });
});
