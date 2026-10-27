import { divideCentsRoundHalfUp, toCents, unitCostFromCents } from "@shared/domain/money";

/** Despesa total da entrada → custo efetivo por unidade (aritmética inteira em 1/10.000 de real) e parte da despesa por unidade. */
export function applyEntryExtraCost(input: { unitCost: number; quantity: number; extraCost?: number }): {
  unitCost: number;
  acquisitionExtraCost: number | undefined;
} {
  const extraCents = toCents(input.extraCost ?? 0);
  if (extraCents <= 0) return { unitCost: input.unitCost, acquisitionExtraCost: undefined };
  return {
    unitCost:
      divideCentsRoundHalfUp(Math.round(input.unitCost * 10_000) * input.quantity + extraCents * 100, input.quantity) / 10_000,
    acquisitionExtraCost: unitCostFromCents(extraCents, input.quantity),
  };
}
