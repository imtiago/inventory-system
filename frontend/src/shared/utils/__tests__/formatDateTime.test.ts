import { afterEach, describe, expect, test } from 'vitest';

import { formatDateTime } from '../formatDateTime';

const originalTz = process.env.TZ;

afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe('formatDateTime', () => {
  test('usa America/Sao_Paulo mesmo com o navegador em outro fuso (perto da meia-noite)', () => {
    process.env.TZ = 'UTC';
    // 02:30 UTC de 27/10 = 23:30 de 26/10 em São Paulo (UTC-3).
    expect(formatDateTime('2026-10-27T02:30:00.000Z')).toMatch(/^26\/10\/2026,? 23:30$/);

    process.env.TZ = 'Asia/Tokyo';
    expect(formatDateTime('2026-10-27T02:30:00.000Z')).toMatch(/^26\/10\/2026,? 23:30$/);
  });

  test('mostra dia/mês/ano com 4 dígitos e hora, sempre em pt-BR', () => {
    expect(formatDateTime('2026-10-26T15:30:00.000Z')).toMatch(/^26\/10\/2026,? \d{2}:\d{2}$/);
  });

  test('vazio ou inválido vira "—"', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('')).toBe('—');
    expect(formatDateTime('não é data')).toBe('—');
  });
});
