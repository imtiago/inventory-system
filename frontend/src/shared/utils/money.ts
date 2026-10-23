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
