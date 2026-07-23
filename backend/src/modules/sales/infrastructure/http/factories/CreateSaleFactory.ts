import { CreateSale } from "@sales/application/useCases/CreateSale";
import { PrismaSaleRepository } from "@sales/infrastructure/prisma/repositories/PrismaSaleRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeCreateSaleUseCase() {
  const saleRepository = new PrismaSaleRepository();

  const transaction = new PrismaTransactionManager();

  const customerService = new CustomerApplicationService();

  const catalogService = new CatalogService();

  const inventoryService = new InventoryService();

  const financialService = new FinancialService();

  return new CreateSale(
    saleRepository,

    transaction,

    customerService,

    catalogService,

    inventoryService,

    financialService,
  );
}
