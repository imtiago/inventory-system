import { describe, expect, test } from 'vitest';

import { formatMoneyInput, moneyTextError, parseMoneyToCents } from '../money';

describe('parseMoneyToCents (pt-BR: "," decimal, "." milhar)', () => {
  test.each([
    ['1.000', 100000],
    ['1.234,56', 123456],
    ['1.234.567,89', 123456789],
    ['12,5', 1250],
    ['12,50', 1250],
    ['12,', 1200],
    ['0,1', 10],
    ['0,10', 10],
    [',5', 50],
    ['12', 1200],
    ['0', 0],
    ['R$ 12,50', 1250],
    ['  12,50 ', 1250],
    // Ponto + 1-2 dígitos = decimal (digitado no celular); ponto + exatamente 3 dígitos = milhar.
    ['39.9', 3990],
    ['12.50', 1250],
    ['12.345', 1234500],
    ['1.234.567', 123456700],
    ['-5,25', -525],
  ])('%s -> %i centavos', (text, cents) => {
    expect(parseMoneyToCents(text)).toBe(cents);
  });

  test.each(['', '   ', 'abc', '12a', '1,2,3', '1.23,4', '1,234.56', '12,345', '1.2345', '0.500', '1..000', '.5', '10.00.00', '--5', '1.000.00', 'R$'])('"%s" -> null', (text) => {
    expect(parseMoneyToCents(text)).toBeNull();
  });
});

describe('moneyTextError', () => {
  test.each([
    ['12,345', 'Use no máximo 2 casas decimais'],
    ['1.2345', 'Use no máximo 2 casas decimais'],
    ['abc', 'Valor inválido'],
    ['1.23,4', 'Valor inválido'],
    ['1,2,3', 'Valor inválido'],
    ['0.500', 'Valor inválido'],
    ['-5', 'O valor não pode ser negativo'],
  ])('%s -> %s', (text, message) => {
    expect(moneyTextError(text)).toBe(message);
  });

  test.each(['1.000', '1.234,56', '12,5', '39.9', '0'])('%s é válido', (text) => {
    expect(moneyTextError(text)).toBeNull();
  });

  test('vazio: erro de obrigatório só quando exigido', () => {
    expect(moneyTextError('')).toBe('Informe um valor');
    expect(moneyTextError('  ', { allowEmpty: true })).toBeNull();
  });

  test('negativo só quando o campo permite', () => {
    expect(moneyTextError('-5,25', { allowNegative: true })).toBeNull();
  });
});

describe('formatMoneyInput (valor preenchido em pt-BR)', () => {
  test.each([
    [39.9, '39,90'],
    [1234.56, '1.234,56'],
    [1000, '1.000,00'],
    [0, '0,00'],
    [0.1, '0,10'],
  ])('%d -> %s', (value, text) => {
    expect(formatMoneyInput(value)).toBe(text);
  });

  test('ida e volta: formatar e interpretar devolve os mesmos centavos', () => {
    for (const reais of [0.01, 39.9, 1234.56, 1000, 99999.99]) {
      expect(parseMoneyToCents(formatMoneyInput(reais))).toBe(Math.round(reais * 100));
    }
  });
});
