import {
  FinancialSectionDTO,
  InventorySectionDTO,
  PricingSectionDTO,
  ProfitSectionDTO,
  PurchasesSectionDTO,
  SalesSectionDTO,
} from "../dto/DashboardDTO";

/** Leitura agregada do dashboard; `today` é a data de negócio ("YYYY-MM-DD"). */
export interface DashboardReadRepository {
  sales(today: string): Promise<SalesSectionDTO>;
  receivables(today: string): Promise<FinancialSectionDTO>;
  payables(today: string): Promise<FinancialSectionDTO>;
  inventory(today: string): Promise<InventorySectionDTO>;
  purchases(): Promise<PurchasesSectionDTO>;
  profit(today: string): Promise<ProfitSectionDTO>;
  pricing(): Promise<PricingSectionDTO>;
}
