import { describe, expect, test } from 'vitest';

import { statusTone, toneFor } from '../statusTone';

describe('statusTone', () => {
  test.each([
    // vendas
    ['COMPLETED', 'success'],
    ['PENDING', 'warning'],
    ['CANCELED', 'danger'],
    // contas a receber/pagar e parcelas
    ['OPEN', 'info'],
    ['PARTIALLY_PAID', 'warning'],
    ['PAID', 'success'],
    ['OVERDUE', 'danger'],
    // compras
    ['PARTIALLY_RECEIVED', 'warning'],
    ['RECEIVED', 'success'],
    // NF-e
    ['DRAFT', 'warning'],
    ['CONFIRMED', 'success'],
    // estoque
    ['AVAILABLE', 'success'],
    ['RESERVED', 'info'],
    ['OUT_OF_STOCK', 'danger'],
    // usuários
    ['ACTIVE', 'success'],
    ['INACTIVE', 'neutral'],
  ] as const)('%s → %s', (status, tone) => {
    expect(statusTone[status]).toBe(tone);
    expect(toneFor(status)).toBe(tone);
  });

  test('status desconhecido é neutral', () => {
    expect(toneFor('WHATEVER')).toBe('neutral');
    expect(toneFor(undefined)).toBe('neutral');
  });
});
