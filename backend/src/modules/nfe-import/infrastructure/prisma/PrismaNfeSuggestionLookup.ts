import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import {
  BarcodeMatch,
  NfeSuggestionLookup,
  SupplierMappingMatch,
} from "@nfe-import/application/contracts/NfeSuggestionLookup";

const variantSelect = { id: true, name: true, code: true, barcode: true, product: { select: { name: true } } } as const;

export class PrismaNfeSuggestionLookup implements NfeSuggestionLookup {
  async findSupplierByDocument(document: string): Promise<{ id: string; name: string } | null> {
    return getDb().supplier.findUnique({ where: { document }, select: { id: true, name: true } });
  }

  async findMappings(supplierId: string, supplierCodes: string[]): Promise<SupplierMappingMatch[]> {
    if (supplierCodes.length === 0) return [];
    const rows = await getDb().supplierProductMapping.findMany({
      where: { supplierId, supplierCode: { in: supplierCodes } },
      select: { supplierCode: true, unitsPerPackage: true, productVariant: { select: variantSelect } },
    });
    return rows.map((r) => ({
      supplierCode: r.supplierCode,
      unitsPerPackage: r.unitsPerPackage,
      productVariantId: r.productVariant.id,
      productName: r.productVariant.product.name,
      variantName: r.productVariant.name,
      variantCode: r.productVariant.code,
    }));
  }

  async findVariantsByBarcodes(barcodes: string[]): Promise<BarcodeMatch[]> {
    if (barcodes.length === 0) return [];
    const rows = await getDb().productVariant.findMany({
      where: { barcode: { in: barcodes } },
      select: variantSelect,
    });
    return rows.map((v) => ({
      barcode: v.barcode as string,
      productVariantId: v.id,
      productName: v.product.name,
      variantName: v.name,
      variantCode: v.code,
    }));
  }
}
