import { BusinessRuleError, ErrorCodes } from "@shared/domain/errors";
import { cost4ToCents, type Cost4 } from "@shared/domain/cost4";
import { divideCentsRoundHalfUp } from "@shared/domain/money";
import { applyBps, ceilDiv, type Bps } from "@shared/domain/percent";
import { roundPrice, type RoundingStrategy } from "./priceRounding";

export function assertPercentSum(expensesBps: Bps, marginBps: Bps): void {
  if (expensesBps + marginBps >= 10_000) {
    throw new BusinessRuleError("Despesas e margem somam 100% ou mais", ErrorCodes.PRICING_PERCENT_SUM_TOO_HIGH);
  }
}

export function suggestedPriceCents(input: {
  averageCost4: Cost4;
  expensesBps: Bps;
  marginBps: Bps;
  strategy: RoundingStrategy;
}): number {
  assertPercentSum(input.expensesBps, input.marginBps);
  const raw = ceilDiv(input.averageCost4 * 100, 10_000 - input.expensesBps - input.marginBps);
  return roundPrice(raw, input.strategy);
}

function marginBpsOf(marginCents: number, chargedCents: number): Bps {
  return chargedCents === 0 ? 0 : Math.round((marginCents * 10_000) / chargedCents);
}

export function realMargin(input: {
  priceCents: number;
  unitCost4: Cost4;
  expensesBps: Bps;
  cardFeeBps?: Bps;
  chargedCents?: number;
}): { marginCents: number; marginBps: Bps } {
  const charged = input.chargedCents ?? input.priceCents;
  const marginCents =
    charged -
    applyBps(charged, input.cardFeeBps ?? 0) -
    cost4ToCents(input.unitCost4) -
    applyBps(input.priceCents, input.expensesBps);
  return { marginCents, marginBps: marginBpsOf(marginCents, charged) };
}

/** Margem-alvo: variante > produto > categoria > loja (null cai para o próximo nível). */
export function resolveTargetMarginBps(levels: {
  variant: Bps | null;
  product: Bps | null;
  category: Bps | null;
  store: Bps;
}): Bps {
  return levels.variant ?? levels.product ?? levels.category ?? levels.store;
}

/** Despesa mensal fixa como % do faturamento mensal (bps, meio para cima). */
export function expenseBpsFromMonthly(monthlyCents: number, monthlyRevenueCents: number): Bps {
  if (!Number.isSafeInteger(monthlyRevenueCents) || monthlyRevenueCents <= 0) {
    throw new RangeError("Faturamento mensal deve ser maior que zero.");
  }
  return divideCentsRoundHalfUp(monthlyCents * 10_000, monthlyRevenueCents);
}

export function saleMargin(input: {
  lines: { quantity: number; unitPriceCents: number; unitCost4: Cost4 | null }[];
  chargedCents: number;
  expensesBps: Bps;
  cardFeeBps: Bps;
}): { marginCents: number; marginBps: Bps; missingCost: boolean } {
  let revenue = 0;
  let cost4Total = 0;
  let missingCost = false;
  for (const line of input.lines) {
    revenue += line.quantity * line.unitPriceCents;
    if (line.unitCost4 === null) missingCost = true;
    else cost4Total += line.quantity * line.unitCost4;
  }
  const marginCents =
    input.chargedCents -
    applyBps(input.chargedCents, input.cardFeeBps) -
    cost4ToCents(cost4Total) -
    applyBps(revenue, input.expensesBps);
  return { marginCents, marginBps: marginBpsOf(marginCents, input.chargedCents), missingCost };
}
