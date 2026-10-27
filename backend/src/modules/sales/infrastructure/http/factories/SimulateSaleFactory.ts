import { makeCatalogService } from "@catalog/infrastructure/http/factories/CatalogServiceFactory";
import { makeCustomerService } from "@customer/infrastructure/http/factories/CustomerService";
import { PrismaPricingSettingsReader } from "@pricing/infrastructure/prisma/PrismaPricingSettingsReader";
import { SimulateSaleUseCase } from "@sales/application/useCases/queries/SimulateSaleUseCase";
import { PrismaSaleCostReader } from "@sales/infrastructure/prisma/contracts/PrismaSaleCostReader";

export function makeSimulateSaleUseCase() {
  return new SimulateSaleUseCase(
    makeCustomerService(),
    makeCatalogService(),
    new PrismaPricingSettingsReader(),
    new PrismaSaleCostReader(),
  );
}
