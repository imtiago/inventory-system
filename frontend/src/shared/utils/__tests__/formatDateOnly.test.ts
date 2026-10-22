import { describe, expect, test } from 'vitest';

import { formatDateOnly } from '../formatDateOnly';

describe('formatDateOnly', () => {
  test('formata a data em UTC no padrão pt-BR', () => {
    expect(formatDateOnly('2026-12-31T00:00:00.000Z')).toBe('31/12/2026');
  });

  test('null retorna "—"', () => {
    expect(formatDateOnly(null)).toBe('—');
  });

  test('data inválida retorna "—" em vez de lançar', () => {
    expect(formatDateOnly('não é data')).toBe('—');
  });
});
