import { CatalogService } from "@catalog/application/services/CatalogService";
export class GetInventoryByProductVariantBarcode {
  constructor(private catalogService: CatalogService) {}

  async execute(barcode: string) {
    return this.catalogService.getProductVariantByBarcode(barcode);
  }
}
