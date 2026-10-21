import { makeCatalogService } from "@catalog/infrastructure/http/factories/CatalogServiceFactory";
import { GetInventoryByProductVariantBarcode } from "@inventory/application/useCases/queries/GetInventoryByProductVariantBarcodeUseCase";

export function makeGetInventoryByProductVariantBarcode() {
  const catalogService = makeCatalogService();

  return new GetInventoryByProductVariantBarcode(catalogService);
}
