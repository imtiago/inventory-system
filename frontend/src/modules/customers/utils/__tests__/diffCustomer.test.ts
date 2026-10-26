import { describe, expect, test } from 'vitest';

import { diffCustomer } from '../diffCustomer';
import type { ICustomer } from '../../types';

const customer: ICustomer = {
  id: 'c1', code: 'C000001', name: 'Ana', email: null, phone: null, address: null, document: '52998224725', createdAt: '2026-10-23T12:00:00.000Z',
};

describe('diffCustomer: document', () => {
  test('mesmo documento (com máscara) não gera alteração', () => {
    expect(diffCustomer(customer, { name: 'Ana', document: '529.982.247-25' })).toEqual({});
  });

  test('documento novo vai só com os dígitos; vazio limpa com null', () => {
    expect(diffCustomer(customer, { name: 'Ana', document: '11.222.333/0001-81' })).toEqual({ document: '11222333000181' });
    expect(diffCustomer(customer, { name: 'Ana', document: null })).toEqual({ document: null });
    expect(diffCustomer({ ...customer, document: null }, { name: 'Ana', document: null })).toEqual({});
  });
});
