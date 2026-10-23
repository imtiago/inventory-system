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

/**
 * Divide centavos inteiros (≥ 0) por um divisor inteiro positivo, arredondando
 * meio para cima — em aritmética inteira (ex.: custo unitário = total / quantidade).
 */
export function divideCentsRoundHalfUp(cents: number, divisor: number): number {
  if (!Number.isSafeInteger(cents) || cents < 0 || !Number.isSafeInteger(divisor) || divisor <= 0) {
    throw new RangeError("divideCentsRoundHalfUp exige centavos inteiros ≥ 0 e divisor inteiro > 0.");
  }
  const quotient = Math.floor(cents / divisor);
  const rest = cents - quotient * divisor;
  return rest * 2 >= divisor ? quotient + 1 : quotient;
}
