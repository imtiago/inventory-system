import { describe, expect, test } from 'vitest';

import { resolveApiBaseUrl } from '../apiBaseUrl';

describe('resolveApiBaseUrl', () => {
  test('VITE_API_URL sempre vence, em dev ou produção', () => {
    expect(resolveApiBaseUrl({ VITE_API_URL: 'https://api.exemplo.com', DEV: true })).toBe('https://api.exemplo.com');
    expect(resolveApiBaseUrl({ VITE_API_URL: 'https://api.exemplo.com', DEV: false })).toBe('https://api.exemplo.com');
  });

  test('em dev sem VITE_API_URL usa o proxy /api do Vite (mesma origem, funciona no celular)', () => {
    expect(resolveApiBaseUrl({ DEV: true })).toBe('/api');
  });

  test('fora do dev sem VITE_API_URL usa /api na mesma origem (nginx faz o proxy)', () => {
    expect(resolveApiBaseUrl({ DEV: false })).toBe('/api');
    expect(resolveApiBaseUrl({})).toBe('/api');
  });

  test('VITE_API_URL vazia conta como não definida', () => {
    expect(resolveApiBaseUrl({ VITE_API_URL: '', DEV: true })).toBe('/api');
    expect(resolveApiBaseUrl({ VITE_API_URL: '', DEV: false })).toBe('/api');
  });
});
