export interface SuggestedVariant {
  productVariantId: string;
  productName: string;
  variantName: string;
  variantCode: string;
}

export interface SupplierMappingMatch extends SuggestedVariant {
  supplierCode: string;
  unitsPerPackage: number;
}

export interface BarcodeMatch extends SuggestedVariant {
  barcode: string;
}

/** Consultas em lote para as sugestões (uma consulta por tipo, sem N+1). */
export interface NfeSuggestionLookup {
  findSupplierByDocument(document: string): Promise<{ id: string; name: string } | null>;
  findMappings(supplierId: string, supplierCodes: string[]): Promise<SupplierMappingMatch[]>;
  findVariantsByBarcodes(barcodes: string[]): Promise<BarcodeMatch[]>;
}
