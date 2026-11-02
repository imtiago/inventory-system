import { describe, expect, test } from 'vitest';

import { addMonthsToDateOnly, suggestSplit } from '../splitParcels';

describe('suggestSplit', () => {
  test('parcelas iguais, a última absorve os centavos', () => {
    const rows = suggestSplit(10000, 3, '2026-12-05');

    expect(rows.map((r) => r.amount)).toEqual(['33,33', '33,33', '33,34']);
    expect(rows.map((r) => r.dueDate)).toEqual(['2026-12-05', '2027-01-05', '2027-02-05']);
  });

  test('dia 31 é limitado ao fim do mês', () => {
    expect(addMonthsToDateOnly('2026-12-31', 2)).toBe('2027-02-28');
    expect(addMonthsToDateOnly('2027-12-15', 1)).toBe('2028-01-15');
  });
});
