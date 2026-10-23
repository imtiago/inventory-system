import { describe, expect, test } from 'vitest';

import { addDaysLocal, addDaysToDateOnly, buildInstallments } from '../installments';

describe('buildInstallments (mesma regra do backend)', () => {
  test('10000/3: piso por parcela, resto na última; 31/01 recortado ao fim do mês', () => {
    expect(buildInstallments(10000, 3, '2027-01-31')).toEqual([
      { amountCents: 3333, dueDate: '2027-01-31' },
      { amountCents: 3333, dueDate: '2027-02-28' },
      { amountCents: 3334, dueDate: '2027-03-31' },
    ]);
  });

  test('ano bissexto e virada de ano; dia recalculado a partir do original', () => {
    expect(buildInstallments(100, 2, '2028-01-31').map((p) => p.dueDate)).toEqual(['2028-01-31', '2028-02-29']);
    expect(buildInstallments(100, 3, '2026-11-30').map((p) => p.dueDate)).toEqual(['2026-11-30', '2026-12-30', '2027-01-30']);
    expect(buildInstallments(100, 4, '2027-01-30').map((p) => p.dueDate)).toEqual(['2027-01-30', '2027-02-28', '2027-03-30', '2027-04-30']);
  });

  test('soma exata e 1x', () => {
    const parcels = buildInstallments(5, 3, '2026-11-21');
    expect(parcels.map((p) => p.amountCents)).toEqual([1, 1, 3]);
    expect(buildInstallments(999, 1, '2026-11-21')).toEqual([{ amountCents: 999, dueDate: '2026-11-21' }]);
  });
});

describe('addDaysLocal', () => {
  test('soma dias em data local formatada YYYY-MM-DD', () => {
    expect(addDaysLocal(new Date(2026, 9, 22, 23, 30), 30)).toBe('2026-11-21');
    expect(addDaysLocal(new Date(2026, 11, 15), 30)).toBe('2027-01-14');
  });
});

describe('addDaysToDateOnly', () => {
  test('soma dias sem depender do fuso', () => {
    expect(addDaysToDateOnly('2026-10-23', 30)).toBe('2026-11-22');
    expect(addDaysToDateOnly('2026-12-15', 30)).toBe('2027-01-14');
  });
});
