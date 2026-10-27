import { describe, expect, test } from 'vitest';
import { can } from '../permissions';

describe('can', () => {
  test('matriz', () => {
    expect(can('ADMIN', 'users.manage')).toBe(true);
    expect(can('VENDEDOR', 'users.manage')).toBe(false);
    expect(can('VENDEDOR', 'finance.reverse')).toBe(false);
    expect(can('VENDEDOR', 'sales.cancel')).toBe(false);
    expect(can('VENDEDOR', 'sales.cancel.request')).toBe(true);
    expect(can('ADMIN', 'sales.cancel')).toBe(true);
    expect(can('ESTOQUISTA', 'sales.cancel.request')).toBe(false);
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

  test('credit.approve: papel ADMIN ou marca por usuário', () => {
    expect(can({ role: 'VENDEDOR', canApproveCredit: true }, 'credit.approve')).toBe(true);
    expect(can({ role: 'VENDEDOR', canApproveCredit: false }, 'credit.approve')).toBe(false);
    expect(can({ role: 'VENDEDOR' }, 'credit.approve')).toBe(false);
    expect(can({ role: 'ADMIN', canApproveCredit: false }, 'credit.approve')).toBe(true);
    expect(can('ADMIN', 'credit.approve')).toBe(true);
    expect(can('VENDEDOR', 'credit.approve')).toBe(false);
    expect(can({ role: 'ESTOQUISTA', canApproveCredit: true }, 'users.manage')).toBe(false);
    expect(can({ role: 'ESTOQUISTA', canApproveCredit: true }, 'catalog.price')).toBe(false);
  });

  test('credit.manage só ADMIN; a marca de aprovador não concede', () => {
    expect(can('ADMIN', 'credit.manage')).toBe(true);
    expect(can('VENDEDOR', 'credit.manage')).toBe(false);
    expect(can('ESTOQUISTA', 'credit.manage')).toBe(false);
    expect(can({ role: 'VENDEDOR', canApproveCredit: true }, 'credit.manage')).toBe(false);
  });

  test('marca não vale para papel desconhecido nem para sujeito nulo', () => {
    expect(can({ role: '__proto__', canApproveCredit: true }, 'credit.approve')).toBe(false);
    expect(can(null, 'credit.approve')).toBe(false);
    expect(can(undefined, 'credit.approve')).toBe(false);
  });
});
