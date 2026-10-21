import { makeCatalogService } from "@catalog/infrastructure/http/factories/CatalogServiceFactory";
import { GetInventoryByProductVariantBarcodeUseCase } from "@inventory/application/useCases/queries/GetInventoryByProductVariantBarcodeUseCase";

export function makeGetInventoryByProductVariantBarcode() {
  const catalogService = makeCatalogService();

  return new GetInventoryByProductVariantBarcodeUseCase(catalogService);
}
