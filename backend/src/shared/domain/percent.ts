// Percentuais em basis points (inteiros): 30% = 3000. Nunca some float.

export type Bps = number;

/** Converte um percentual (≤ 2 casas, ex.: 3.99) em basis points, robusto a erro de float. */
export function percentToBps(percent: number): Bps {
  if (!Number.isFinite(percent) || percent < 0) throw new RangeError("Percentual inválido.");
  const scaled = Number((percent * 100).toPrecision(15));
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 1e-9) throw new RangeError("Percentual aceita no máximo 2 casas decimais.");
  return rounded;
}

/** Converte basis points em percentual (399 → 3.99). */
export function bpsToPercent(bps: Bps): number {
  return bps / 100;
}

/** Aplica um percentual em bps a centavos inteiros (≥ 0), arredondando meio para cima. */
export function applyBps(cents: number, bps: Bps): number {
  if (!Number.isSafeInteger(cents) || cents < 0 || !Number.isSafeInteger(bps) || bps < 0) {
    throw new RangeError("applyBps exige centavos e bps inteiros ≥ 0.");
  }
  const product = cents * bps;
  const quotient = Math.floor(product / 10_000);
  return (product - quotient * 10_000) * 2 >= 10_000 ? quotient + 1 : quotient;
}

/** Divisão inteira arredondada para cima (a ≥ 0, b > 0). */
export function ceilDiv(a: number, b: number): number {
  if (!Number.isSafeInteger(a) || a < 0 || !Number.isSafeInteger(b) || b <= 0) {
    throw new RangeError("ceilDiv exige inteiros, a ≥ 0 e b > 0.");
  }
  const q = Math.floor(a / b);
  return q * b === a ? q : q + 1;
}
