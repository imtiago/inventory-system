import { FinancialApplicationService } from "@finance/application/services/FinancialApplicationService";
import { CancelPurchasePayableUseCase } from "@finance/application/useCases/commands/CancelPurchasePayableUseCase";
import { CancelSaleReceivableUseCase } from "@finance/application/useCases/commands/CancelSaleReceivableUseCase";
import { CreateFinancialDocumentUseCase } from "@finance/application/useCases/commands/CreateFinancialDocumentUseCase";
import { PrismaFinancialDocumentRepository } from "@finance/infrastructure/prisma/repositories/PrismaFinancialDocumentRepository";
import { PrismaFinancialParcelRepository } from "@finance/infrastructure/prisma/repositories/PrismaFinancialParcelRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeFinancialService() {
  const documents = new PrismaFinancialDocumentRepository();
  const transactionManager = new PrismaTransactionManager();

  return new FinancialApplicationService(
    new CreateFinancialDocumentUseCase(documents, new PrismaFinancialParcelRepository(), transactionManager),
    new CancelSaleReceivableUseCase(documents, transactionManager),
    new CancelPurchasePayableUseCase(documents, transactionManager),
  );
}
