import type { Cost4 } from "@shared/domain/cost4";

/** Custo médio atual por variante (simulação de margem); variante sem inventário fica de fora. */
export interface SaleCostReader {
  averageCosts(variantIds: string[]): Promise<Map<string, Cost4>>;
}
