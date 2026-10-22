import { makeCatalogService } from "@catalog/infrastructure/http/factories/CatalogServiceFactory";
import { makeCustomerService } from "@customer/infrastructure/http/factories/CustomerService";
import { makeFinancialService } from "@finance/infrastructure/http/factories/FinancialServiceFactory";
import { makeInventoryService } from "@inventory/infrastructure/http/factories/InventoryServiceFactory";
import { CreateSaleUseCase } from "@sales/application/useCases/commands/CreateSaleUseCase";
import { PrismaSaleRepository } from "@sales/infrastructure/prisma/repositories/PrismaSaleRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeCreateSaleUseCase() {
  const saleRepository = new PrismaSaleRepository();

  const transaction = new PrismaTransactionManager();

  const customerService = makeCustomerService();

  const catalogService = makeCatalogService();

  const inventoryService = makeInventoryService();

  const financialService = makeFinancialService();

  return new CreateSaleUseCase(
    saleRepository,
    transaction,
    customerService,
    catalogService,
    inventoryService,
    financialService,
  );
}
