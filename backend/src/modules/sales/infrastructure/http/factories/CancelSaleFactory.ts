import { makeFinancialService } from "@finance/infrastructure/http/factories/FinancialServiceFactory";
import { makeInventoryService } from "@inventory/infrastructure/http/factories/InventoryServiceFactory";
import { CancelSaleUseCase } from "@sales/application/useCases/commands/CancelSaleUseCase";
import { PrismaSaleRepository } from "@sales/infrastructure/prisma/repositories/PrismaSaleRepository";
import { PrismaSaleCancelRequestRepository } from "@sales/infrastructure/prisma/repositories/PrismaSaleCancelRequestRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeCancelSaleUseCase() {
  return new CancelSaleUseCase(
    new PrismaSaleRepository(),
    new PrismaTransactionManager(),
    makeInventoryService(),
    makeFinancialService(),
    new PrismaSaleCancelRequestRepository(),
  );
}
