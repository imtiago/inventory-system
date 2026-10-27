import { hasPermission } from "./permissions";

/**
 * Custo do estoque (custo médio, custo do lote, despesas de aquisição, valor em estoque).
 * ADMIN e ESTOQUISTA (quem dá entrada e digita custo, `inventory.write`) veem; VENDEDOR não.
 * Margem/lucro/margem-alvo/preço do fornecedor continuam só do ADMIN (`pricing.manage`).
 */
export function canSeeStockCost(role: string | undefined): boolean {
  return !!role && hasPermission(role, "inventory.write");
}
