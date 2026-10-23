// Dinheiro em centavos inteiros em todo cálculo; Decimal só na persistência.

/** Converte um valor monetário em centavos inteiros (meio afasta do zero, robusto a erro de float). */
export function toCents(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const cents = Number((Math.abs(value) * 100).toPrecision(15));
  const rounded = Math.round(cents);
  return rounded === 0 ? 0 : sign * rounded;
}

/** Converte centavos inteiros em valor monetário. */
export function fromCents(cents: number): number {
  return cents / 100;
}
