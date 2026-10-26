import { describe, expect, test, vi } from 'vitest';

import { queryClient } from '@/shared/react-query/queryClient';
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

function jwtFor(sub: string) {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64({ sub })}.sig`;
}

describe('auth store: sincronização entre abas', () => {
  const user = { id: 'u1', name: 'A', email: 'a@x.com', role: 'ADMIN' as const };

  test('logout em outra aba (token removido) desloga esta e limpa o cache', () => {
    useAuthStore.getState().setSession('t1', user);
    queryClient.setQueryData(['x'], 1);

    window.dispatchEvent(new StorageEvent('storage', { key: 'token', newValue: null }));

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().sessionExpired).toBe(false);
    expect(queryClient.getQueryData(['x'])).toBeUndefined();
  });

  test('troca de token do mesmo usuário (troca de senha) mantém usuário e cache', () => {
    useAuthStore.getState().setSession(jwtFor('u1'), user);
    queryClient.setQueryData(['x'], 1);
    const novo = jwtFor('u1') + 'x';

    window.dispatchEvent(new StorageEvent('storage', { key: 'token', newValue: novo }));

    expect(useAuthStore.getState().token).toBe(novo);
    expect(useAuthStore.getState().user).toEqual(user);
    expect(queryClient.getQueryData(['x'])).toBe(1);
  });

  test('token de outro usuário limpa cache e usuário (revalida em /users/me)', () => {
    useAuthStore.getState().setSession(jwtFor('u1'), user);
    queryClient.setQueryData(['x'], 1);
    const outro = jwtFor('u2');

    window.dispatchEvent(new StorageEvent('storage', { key: 'token', newValue: outro }));

    expect(useAuthStore.getState().token).toBe(outro);
    expect(useAuthStore.getState().user).toBeNull();
    expect(queryClient.getQueryData(['x'])).toBeUndefined();
  });

  test('login em outra aba enquanto esta está deslogada adota o token', () => {
    useAuthStore.getState().logout();
    window.dispatchEvent(new StorageEvent('storage', { key: 'token', newValue: jwtFor('u3') }));
    expect(useAuthStore.getState().token).toBe(jwtFor('u3'));
    expect(useAuthStore.getState().user).toBeNull();
  });

  test('outras chaves são ignoradas', () => {
    useAuthStore.getState().setSession('t1', user);
    window.dispatchEvent(new StorageEvent('storage', { key: 'ui.theme', newValue: 'dark' }));
    expect(useAuthStore.getState().token).toBe('t1');
  });

  test('localStorage bloqueado não quebra login, troca de token nem logout', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    const spies = [
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked),
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked),
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked),
    ];
    try {
      expect(() => useAuthStore.getState().setSession('t-mem', user)).not.toThrow();
      expect(useAuthStore.getState().token).toBe('t-mem');
      expect(() => useAuthStore.getState().setToken('t-mem-2')).not.toThrow();
      expect(useAuthStore.getState().token).toBe('t-mem-2');
      expect(() => useAuthStore.getState().logout()).not.toThrow();
      expect(useAuthStore.getState().token).toBeNull();
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });
});
