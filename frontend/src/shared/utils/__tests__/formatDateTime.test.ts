import { describe, expect, test } from 'vitest';

import { formatDateTime } from '../formatDateTime';

describe('formatDateTime', () => {
  test('mostra dia/mês/ano com 4 dígitos e hora, sempre em pt-BR', () => {
    expect(formatDateTime('2026-10-26T15:30:00.000Z')).toMatch(/^26\/10\/2026,? \d{2}:\d{2}$/);
  });

  test('vazio ou inválido vira "—"', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('')).toBe('—');
    expect(formatDateTime('não é data')).toBe('—');
  });
});
