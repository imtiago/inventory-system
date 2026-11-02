import { FinancialApplicationService } from "@finance/application/services/FinancialApplicationService";
import { CancelPurchasePayableUseCase } from "@finance/application/useCases/commands/CancelPurchasePayableUseCase";
import { CancelSaleReceivableUseCase } from "@finance/application/useCases/commands/CancelSaleReceivableUseCase";
import { CreateFinancialDocumentUseCase } from "@finance/application/useCases/commands/CreateFinancialDocumentUseCase";
import { CreatePaidSaleReceivableUseCase } from "@finance/application/useCases/commands/CreatePaidSaleReceivableUseCase";
import { CreateCrediarioReceivableUseCase } from "@finance/application/useCases/commands/CreateCrediarioReceivableUseCase";
import { PrismaFinancialDocumentRepository } from "@finance/infrastructure/prisma/repositories/PrismaFinancialDocumentRepository";
import { PrismaFinancialParcelRepository } from "@finance/infrastructure/prisma/repositories/PrismaFinancialParcelRepository";
import { PrismaPaymentRepository } from "@finance/infrastructure/prisma/repositories/PrismaPaymentRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeFinancialService() {
  const documents = new PrismaFinancialDocumentRepository();
  const parcels = new PrismaFinancialParcelRepository();
  const payments = new PrismaPaymentRepository();
  const transactionManager = new PrismaTransactionManager();

  return new FinancialApplicationService(
    new CreateFinancialDocumentUseCase(documents, parcels, transactionManager),
    new CancelSaleReceivableUseCase(documents, payments, transactionManager),
    new CancelPurchasePayableUseCase(documents, transactionManager),
    new CreatePaidSaleReceivableUseCase(documents, parcels, payments, transactionManager),
    new CreateCrediarioReceivableUseCase(documents, parcels, payments, transactionManager),
  );
}
