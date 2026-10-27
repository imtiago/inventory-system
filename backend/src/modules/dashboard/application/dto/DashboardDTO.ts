/** Valores monetários em reais (2 casas); datas "YYYY-MM-DD" no fuso de negócio. */
export interface CountTotalDTO {
  count: number;
  total: number;
}

export interface SalesDayDTO extends CountTotalDTO {
  date: string;
}

export interface TopVariantDTO {
  productVariantId: string;
  label: string;
  quantity: number;
  total: number;
}

export interface SalesSectionDTO {
  today: CountTotalDTO;
  month: CountTotalDTO;
  last7Days: SalesDayDTO[];
  topVariants: TopVariantDTO[];
}

export interface FinancialSectionDTO {
  open: number;
  overdue: number;
  dueNext7Days: { count: number; amount: number };
}

export interface OutOfStockItemDTO {
  productVariantId: string;
  label: string;
  quantity: number;
}

export interface ExpiringLotDTO {
  lotId: string;
  batchNumber: string | null;
  label: string;
  expirationDate: string;
  remainingQuantity: number;
}

export interface InventorySectionDTO {
  outOfStockCount: number;
  outOfStock: OutOfStockItemDTO[];
  expiringLots: { count: number; items: ExpiringLotDTO[] };
}

export interface PurchasesSectionDTO {
  awaitingReceipt: CountTotalDTO;
}

/** Lucro do mês (receita − custo registrado − despesas estimadas); só com `reports.profit`. */
export interface ProfitSectionDTO {
  month: { revenue: number; profit: number; marginPercent: number | null };
}

export interface DashboardDTO {
  generatedAt: string;
  sales?: SalesSectionDTO;
  receivables?: FinancialSectionDTO;
  payables?: FinancialSectionDTO;
  inventory?: InventorySectionDTO;
  purchases?: PurchasesSectionDTO;
  profit?: ProfitSectionDTO;
}
