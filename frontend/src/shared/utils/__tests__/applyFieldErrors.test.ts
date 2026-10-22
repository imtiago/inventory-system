import { describe, expect, test, vi } from 'vitest';

import { applyFieldErrors } from '../applyFieldErrors';

describe('applyFieldErrors', () => {
  test('aplica campo conhecido', () => {
    const setError = vi.fn();

    const result = applyFieldErrors(setError, { email: 'E-mail inválido.' }, ['email', 'name']);

    expect(setError).toHaveBeenCalledWith('email', { type: 'server', message: 'E-mail inválido.' });
    expect(result).toEqual({ applied: ['email'], unmatched: {} });
  });

  test('devolve campos desconhecidos sem aplicar', () => {
    const setError = vi.fn();

    const result = applyFieldErrors(setError, { sku: 'SKU inválido.', name: 'Obrigatório.' }, ['name']);

    expect(setError).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ applied: ['name'], unmatched: { sku: 'SKU inválido.' } });
  });

  test('suporta caminho pontilhado quando listado', () => {
    const setError = vi.fn();

    const result = applyFieldErrors(setError, { 'items.0.quantity': 'Qtd inválida.' }, ['items.0.quantity']);

    expect(setError).toHaveBeenCalledWith('items.0.quantity', { type: 'server', message: 'Qtd inválida.' });
    expect(result.unmatched).toEqual({});
  });

  test('caminho pontilhado não listado vai para unmatched', () => {
    const result = applyFieldErrors(vi.fn(), { 'items.0.quantity': 'Qtd inválida.' }, ['items']);

    expect(result.unmatched).toEqual({ 'items.0.quantity': 'Qtd inválida.' });
  });
});
