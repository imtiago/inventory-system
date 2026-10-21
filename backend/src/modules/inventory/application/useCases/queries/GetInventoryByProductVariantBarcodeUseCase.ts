import { CatalogService } from "@catalog/application/services/CatalogService";
export class GetInventoryByProductVariantBarcodeUseCase {
  constructor(private catalogService: CatalogService) {}

  async execute(barcode: string) {
    return this.catalogService.getProductVariantByBarcode(barcode);
  }
}
