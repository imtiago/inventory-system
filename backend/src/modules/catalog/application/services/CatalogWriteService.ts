/** Escrita no catálogo para outros módulos (ex.: confirmação de NF-e). Participa da transação do chamador. */
export interface CatalogWriteService {
  /**
   * Cria o produto com exatamente uma variante (nome, código de barras, preço de venda).
   * Marca/categoria inexistentes → 404; código de barras em uso → 409 BARCODE_ALREADY_EXISTS.
   */
  createProductWithVariant(input: {
    name: string;
    description?: string | null;
    brandId: string;
    categoryId: string;
    variant: { name: string; barcode?: string | null; salePrice: number };
  }): Promise<{ productId: string; productVariantId: string }>;
  /** Nova variante em produto existente: produto inexistente → 404; código de barras em uso → 409. */
  createVariant(input: {
    productId: string;
    name: string;
    barcode?: string | null;
    salePrice: number;
  }): Promise<{ productVariantId: string }>;
}
