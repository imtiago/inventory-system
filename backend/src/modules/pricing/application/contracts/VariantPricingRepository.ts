import type { Cost4 } from "@shared/domain/cost4";

export interface VariantPricingSource {
  variantId: string;
  salePriceCents: number;
  /** Custo médio do estoque (0 se a variante ainda não tem inventário). */
  averageCost4: Cost4;
  supplierPriceCents: number | null;
  supplierPriceUpdatedAt: Date | null;
}

export interface VariantPricingReader {
  find(variantId: string): Promise<VariantPricingSource | null>;
}

export interface VariantPricingWriter {
  /** Trava a linha da variante até o fim da transação; false se não existe. */
  lockVariant(variantId: string): Promise<boolean>;
  setSupplierPrice(variantId: string, cents: number | null): Promise<void>;
  setSalePrice(variantId: string, cents: number): Promise<void>;
}
