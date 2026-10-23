export interface SupplierProductMappingInput {
  supplierId: string;
  supplierCode: string;
  productVariantId: string;
  unitsPerPackage: number;
}

/** Vínculo (fornecedor, código do produto no fornecedor) → variante, aprendido na confirmação. */
export interface SupplierProductMappingRepository {
  /** Grava ou atualiza (variante e unidades por embalagem) o vínculo do par (supplierId, supplierCode). */
  upsert(mapping: SupplierProductMappingInput): Promise<void>;
}
