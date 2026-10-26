// Custo em unidades de R$ 0,0001 (inteiro), a escala Decimal(14,4) do banco.

export type Cost4 = number;

/** Converte reais com ≤ 4 casas em Cost4 inteiro, robusto a erro de float. */
export function toCost4(value: number): Cost4 {
  if (!Number.isFinite(value) || value < 0) throw new RangeError("Custo inválido.");
  const scaled = Number((value * 10_000).toPrecision(15));
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 1e-9) throw new RangeError("Custo aceita no máximo 4 casas decimais.");
  return rounded;
}

/** Converte Cost4 em centavos, meio para cima. */
export function cost4ToCents(cost: Cost4): number {
  if (!Number.isSafeInteger(cost) || cost < 0) throw new RangeError("cost4ToCents exige inteiro ≥ 0.");
  const q = Math.floor(cost / 100);
  return (cost - q * 100) * 2 >= 100 ? q + 1 : q;
}
