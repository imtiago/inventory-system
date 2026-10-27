/**
 * Rateia `totalCents` (inteiro ≥ 0) em partes proporcionais a `weights` (inteiros ≥ 0).
 * Soma exata: piso de cada parte + centavos que sobram para os maiores restos (empate: menor índice).
 * Pesos todos zero → partes iguais. Aritmética inteira (BigInt), sem float.
 */
export function prorateCents(totalCents: number, weights: readonly number[]): number[] {
  if (
    !Number.isSafeInteger(totalCents) ||
    totalCents < 0 ||
    weights.length === 0 ||
    !weights.every((w) => Number.isSafeInteger(w) && w >= 0)
  ) {
    throw new RangeError("prorateCents exige total inteiro ≥ 0 e pesos inteiros ≥ 0 (ao menos um).");
  }
  const effective = weights.every((w) => w === 0) ? weights.map(() => 1) : [...weights];
  const total = BigInt(totalCents);
  const weightSum = effective.reduce((s, w) => s + BigInt(w), 0n);

  const parts = effective.map((w) => (total * BigInt(w)) / weightSum);
  const rests = effective.map((w) => (total * BigInt(w)) % weightSum);
  let leftover = Number(total - parts.reduce((s, p) => s + p, 0n));

  const order = rests
    .map((rest, index) => ({ rest, index }))
    .sort((a, b) => (a.rest === b.rest ? a.index - b.index : a.rest > b.rest ? -1 : 1));
  const result = parts.map(Number);
  for (const { index } of order) {
    if (leftover === 0) break;
    result[index] += 1;
    leftover -= 1;
  }
  return result;
}
