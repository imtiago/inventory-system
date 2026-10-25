const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Reais (decimal, até 2 casas) -> centavos inteiros. */
export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function formatCurrency(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);

  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

export function formatCents(cents: number): string {
  return formatCurrency(fromCents(cents));
}

/**
 * Texto digitado -> reais (número). Aceita vírgula ("12,50"), ponto ("12.50"), "R$" e milhar ("1.234,56").
 * Vazio -> NaN; não numérico -> NaN. Casas decimais a mais são preservadas para que a validação as acuse.
 */
export function parseMoneyText(text: string): number {
  let normalized = text.replace(/R\$/gi, '').replace(/\s/g, '');
  if (normalized === '') return Number.NaN;
  if (normalized.includes(',')) normalized = normalized.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d*\.?\d*$/.test(normalized) || normalized === '.') return Number.NaN;

  return Number(normalized);
}

/** Texto digitado -> centavos inteiros; null quando vazio, inválido ou com mais de 2 casas decimais. */
export function parseMoneyToCents(text: string): number | null {
  const reais = parseMoneyText(text);
  if (!Number.isFinite(reais)) return null;
  const cents = Math.round(reais * 100);

  return Math.abs(reais * 100 - cents) > 1e-6 ? null : cents;
}
