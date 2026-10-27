import type { TargetMarginSource } from '../types';

const costFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 });

/** Custo unitário: 2 a 4 casas (o custo médio guarda até 4). */
export function formatCost(value: number): string {
  return costFormatter.format(value);
}

export const MARGIN_SOURCE_LABEL: Record<TargetMarginSource, string> = {
  VARIANT: 'da variante',
  PRODUCT: 'do produto',
  CATEGORY: 'da categoria',
  STORE: 'padrão da loja',
};

export function conditionLabel(condition: 'CASH' | 'DEBIT' | 'CREDIT', installments: number): string {
  if (condition === 'CASH') return 'À vista';
  if (condition === 'DEBIT') return 'Débito';

  return `Crédito ${installments}x`;
}
