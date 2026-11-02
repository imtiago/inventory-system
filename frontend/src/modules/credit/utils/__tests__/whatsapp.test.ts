import { describe, expect, it } from 'vitest';

import saleDetailCrediario from '@/test/fixtures/sales/saleDetailCrediario.json';
import type { ISaleDetail } from '@/modules/sales/types';

import { buildCarneMessage, buildWhatsAppLink, isValidMobile } from '../whatsapp';

describe('buildWhatsAppLink', () => {
  it('celular com máscara → wa.me com 55 e o texto codificado', () => {
    expect(buildWhatsAppLink('(11) 98888-7777', 'Olá, tudo bem?')).toBe(`https://wa.me/5511988887777?text=${encodeURIComponent('Olá, tudo bem?')}`);
  });

  it('só dígitos e com 55 na frente também valem', () => {
    expect(buildWhatsAppLink('11988887777', 'oi')).toBe('https://wa.me/5511988887777?text=oi');
    expect(buildWhatsAppLink('+55 11 98888-7777', 'oi')).toBe('https://wa.me/5511988887777?text=oi');
  });

  it('sem telefone ou sem celular válido → null', () => {
    expect(buildWhatsAppLink(null, 'oi')).toBeNull();
    expect(buildWhatsAppLink('', 'oi')).toBeNull();
    expect(buildWhatsAppLink('(11) 3333-4444', 'oi')).toBeNull(); // fixo
    expect(buildWhatsAppLink('98888-7777', 'oi')).toBeNull(); // sem DDD
    expect(buildWhatsAppLink('(01) 98888-7777', 'oi')).toBeNull(); // DDD inválido
    expect(buildWhatsAppLink('(11) 88888-7777', 'oi')).toBeNull(); // celular começa com 9
  });

  it('isValidMobile', () => {
    expect(isValidMobile('11988887777')).toBe(true);
    expect(isValidMobile('1133334444')).toBe(false);
    expect(isValidMobile(null)).toBe(false);
  });
});

describe('buildCarneMessage', () => {
  const sale = saleDetailCrediario.data as unknown as ISaleDetail;

  it('resumo e parcelas em texto, sem a entrada na lista', () => {
    const text = buildCarneMessage(sale);
    expect(text).toContain('Maria');
    expect(text).toContain('#5E8A1C3F');
    expect(text).toContain('Entrada: R$ 90,00');
    expect(text).toContain('Valor financiado: R$ 210,00');
    expect(text).toContain('Total a prazo: R$ 316,97');
    expect(text).toContain('3,99% ao mês');
    expect(text).toContain('1/3 - 26/11/2026 - R$ 75,66');
    expect(text).toContain('3/3 - 26/01/2027 - R$ 75,65');
    expect(text).not.toContain('4/3');
    expect(text).not.toContain('27/10/2026');
    expect(text).not.toContain(' ');
  });

  it('sem entrada: todas as parcelas, sem a linha de entrada', () => {
    const noDown = { ...sale, financing: { ...sale.financing!, downPayment: 0 }, receivable: { ...sale.receivable!, parcels: sale.receivable!.parcels.slice(1) } };
    const text = buildCarneMessage(noDown);
    expect(text).not.toContain('Entrada:');
    expect(text).toContain('1/3 - 26/11/2026');
  });
});
