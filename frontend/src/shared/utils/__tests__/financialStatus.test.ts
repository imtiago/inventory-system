import { describe, expect, it } from 'vitest';
import { FINANCIAL_STATUS_LABELS } from '../financialStatus';

describe('FINANCIAL_STATUS_LABELS', () => {
  it('OPEN é "A vencer"', () => {
    expect(FINANCIAL_STATUS_LABELS.OPEN).toBe('A vencer');
  });
});
