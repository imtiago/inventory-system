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
  test('compras e contas a pagar (6A)', () => {
    expect(can('ADMIN', 'payables.reverse')).toBe(true);
    expect(can('ESTOQUISTA', 'purchases.read')).toBe(true);
    expect(can('ESTOQUISTA', 'purchases.receive')).toBe(true);
    expect(can('ESTOQUISTA', 'purchases.write')).toBe(false);
    expect(can('ESTOQUISTA', 'payables.read')).toBe(false);
    expect(can('VENDEDOR', 'purchases.read')).toBe(false);
    expect(can('VENDEDOR', 'payables.pay')).toBe(false);
  });
  test('desfazer importação de NF-e só ADMIN (onda 7)', () => {
    expect(can('ADMIN', 'purchases.revert')).toBe(true);
    expect(can('VENDEDOR', 'purchases.revert')).toBe(false);
    expect(can('ESTOQUISTA', 'purchases.revert')).toBe(false);
  });
  test('papel desconhecido ou ausente é negado', () => {
    expect(can(undefined, 'self')).toBe(false);
    expect(can('toString', 'self')).toBe(false);
    expect(can('__proto__', 'self')).toBe(false);
  });
});
