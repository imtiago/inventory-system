import { describe, expect, test } from 'vitest';
import { can } from '../permissions';

describe('can', () => {
  test('matriz', () => {
    expect(can('ADMIN', 'users.manage')).toBe(true);
    expect(can('VENDEDOR', 'users.manage')).toBe(false);
    expect(can('VENDEDOR', 'finance.reverse')).toBe(false);
    expect(can('VENDEDOR', 'sales.cancel')).toBe(true);
    expect(can('ESTOQUISTA', 'inventory.write')).toBe(true);
    expect(can('ESTOQUISTA', 'sales.read')).toBe(false);
  });
  test('papel desconhecido ou ausente é negado', () => {
    expect(can(undefined, 'self')).toBe(false);
    expect(can('toString', 'self')).toBe(false);
    expect(can('__proto__', 'self')).toBe(false);
  });
});
