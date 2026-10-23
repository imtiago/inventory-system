import { describe, expect, it } from 'vitest';
import { todayInBusinessTz } from '../businessDate';

describe('todayInBusinessTz', () => {
  it('usa a data de America/Sao_Paulo, não a UTC', () => {
    // 02:00 UTC de 24/10 = 23:00 de 23/10 em São Paulo (UTC-3)
    expect(todayInBusinessTz(new Date('2026-10-24T02:00:00Z'))).toBe('2026-10-23');
    expect(todayInBusinessTz(new Date('2026-10-24T03:00:00Z'))).toBe('2026-10-24');
  });
});
