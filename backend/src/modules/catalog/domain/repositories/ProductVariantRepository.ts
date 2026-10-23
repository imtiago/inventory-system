import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
import { ProductVariant } from "../entities/ProductVariant";

export interface ProductVariantRepository extends ICrudRepository<ProductVariant> {
  findByProduct(productId: string): Promise<ProductVariant[]>;
  findByBarcode(barcode: string): Promise<ProductVariant | null>;
  findByCode(code: string): Promise<ProductVariant | null>;
  /** Trava as variantes do produto (`FOR UPDATE`) e retorna seus ids. */
  lockByProduct(productId: string): Promise<string[]>;
  /**
   * Ids (dentre os informados) em uso: com movimentação, lote, item de venda
   * ou de compra, ou registro de estoque com quantidade/reserva ≠ 0.
   */
  findInUse(variantIds: string[]): Promise<string[]>;
  /** Apaga as variantes e seus registros de estoque (zerados). */
  deleteWithInventory(variantIds: string[]): Promise<void>;
}
