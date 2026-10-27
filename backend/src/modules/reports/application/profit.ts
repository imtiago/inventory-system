import { cost4ToCents } from "@shared/domain/cost4";
import { applyBps, type Bps } from "@shared/domain/percent";
import { fromCents } from "@shared/domain/money";

/** Linha agregada lida do banco: receita em centavos, custo em Cost4 (R$ 0,0001). */
export interface RawProfitRow {
  key: string;
  label: string;
  revenueCents: number;
  cost4: number;
  itemsWithoutCost: number;
}

/** Valores em reais (2 casas); `marginPercent` = lucro / receita (2 casas), null sem receita. */
export interface ProfitRowDTO {
  key: string;
  label: string;
  revenue: number;
  cost: number;
  estimatedExpenses: number;
  profit: number;
  marginPercent: number | null;
  itemsWithoutCost: number;
}

/** Lucro = receita − custo − despesas estimadas (receita × despesas atuais); tudo em centavos inteiros. */
export function toProfitRow(raw: RawProfitRow, expensesBps: Bps): ProfitRowDTO {
  const costCents = cost4ToCents(raw.cost4);
  const expensesCents = applyBps(raw.revenueCents, expensesBps);
  const profitCents = raw.revenueCents - costCents - expensesCents;
  return {
    key: raw.key,
    label: raw.label,
    revenue: fromCents(raw.revenueCents),
    cost: fromCents(costCents),
    estimatedExpenses: fromCents(expensesCents),
    profit: fromCents(profitCents),
    marginPercent: raw.revenueCents > 0 ? Math.round((profitCents * 10_000) / raw.revenueCents) / 100 : null,
    itemsWithoutCost: raw.itemsWithoutCost,
  };
}

/** Linhas + totais; o total soma as linhas (receita, custo e despesas em centavos), então fecha com qualquer agrupamento. */
export function buildProfit(rawRows: RawProfitRow[], expensesBps: Bps): { rows: ProfitRowDTO[]; totals: ProfitRowDTO } {
  const rows = rawRows.map((r) => toProfitRow(r, expensesBps));
  const sumCents = (pick: (r: ProfitRowDTO) => number) => rows.reduce((s, r) => s + Math.round(pick(r) * 100), 0);
  const revenueCents = sumCents((r) => r.revenue);
  const costCents = sumCents((r) => r.cost);
  const expensesCents = sumCents((r) => r.estimatedExpenses);
  const profitCents = revenueCents - costCents - expensesCents;
  return {
    rows,
    totals: {
      key: "total",
      label: "Total",
      revenue: fromCents(revenueCents),
      cost: fromCents(costCents),
      estimatedExpenses: fromCents(expensesCents),
      profit: fromCents(profitCents),
      marginPercent: revenueCents > 0 ? Math.round((profitCents * 10_000) / revenueCents) / 100 : null,
      itemsWithoutCost: rows.reduce((s, r) => s + r.itemsWithoutCost, 0),
    },
  };
}
