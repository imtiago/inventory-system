import { describe, expect, test } from 'vitest';

import { useAuthStore } from '../auth';

describe('auth store logout', () => {
  test('não apaga o token novo gravado por outra aba (troca de senha)', () => {
    useAuthStore.getState().setSession('token-antigo', { id: 'u1', name: 'A', email: 'a@x.com', role: 'ADMIN' });
    localStorage.setItem('token', 'token-novo'); // outra aba trocou a senha

    useAuthStore.getState().logout(true);

    expect(useAuthStore.getState().token).toBeNull();
    expect(localStorage.getItem('token')).toBe('token-novo');
  });

  test('apaga o próprio token', () => {
    useAuthStore.getState().setSession('token-1', { id: 'u1', name: 'A', email: 'a@x.com', role: 'ADMIN' });

    useAuthStore.getState().logout();

    expect(localStorage.getItem('token')).toBeNull();
  });
});
