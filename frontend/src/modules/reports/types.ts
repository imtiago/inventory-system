export type ProfitView = 'period' | 'sale' | 'variant' | 'category';

export interface IProfitRow {
  key: string;
  label: string;
  /** Itens vendidos; o acréscimo (repasse do cartão, juros do crediário) não entra. */
  revenue: number;
  cost: number;
  estimatedExpenses: number;
  /** Taxa de cartão absorvida pela loja (venda no cartão sem repasse ao cliente). */
  cardFees: number;
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
