export type ProfitView = 'period' | 'sale' | 'variant' | 'category';

export interface IProfitRow {
  key: string;
  label: string;
  revenue: number;
  cost: number;
  estimatedExpenses: number;
  profit: number;
  /** null quando a receita é zero. */
  marginPercent: number | null;
  /** Itens vendidos sem custo registrado (não entram no custo; diferente de custo zero). */
  itemsWithoutCost: number;
}

export interface IProfitReport {
  rows: IProfitRow[];
  totals: IProfitRow;
}

export interface IProfitFilters {
  from: string;
  to: string;
  view: ProfitView;
  sellerId?: string;
}
