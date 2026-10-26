import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
import { ProductVariant } from "../entities/ProductVariant";

export type VariantUpdatableField = "name" | "barcode" | "salePrice";

export interface ProductVariantRepository extends ICrudRepository<ProductVariant> {
  /** Grava só os campos indicados (não sobrescreve os demais com valores lidos antes). */
  updateFields(variant: ProductVariant, fields: readonly VariantUpdatableField[]): Promise<ProductVariant>;
  /** Trava a linha da variante (`SELECT … FOR UPDATE`); false se não existe. */
  lockById(id: string): Promise<boolean>;
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
