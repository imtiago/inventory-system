import { FinancialApplicationService } from "@finance/application/services/FinancialApplicationService";
import { CancelSaleReceivableUseCase } from "@finance/application/useCases/commands/CancelSaleReceivableUseCase";
import { PrismaFinancialDocumentRepository } from "@finance/infrastructure/prisma/repositories/PrismaFinancialDocumentRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { makeCreateReceivableUseCase } from "./CreateReceivableFactory";

export function makeFinancialService() {
  const createReceivable = makeCreateReceivableUseCase();
  const cancelSaleReceivable = new CancelSaleReceivableUseCase(
    new PrismaFinancialDocumentRepository(),
    new PrismaTransactionManager(),
  );

  return new FinancialApplicationService(createReceivable, cancelSaleReceivable);
}
