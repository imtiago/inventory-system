import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { PrismaFinancialDocumentRepository } from "@finance/infrastructure/prisma/repositories/PrismaFinancialDocumentRepository";
import { PrismaFinancialParcelRepository } from "@finance/infrastructure/prisma/repositories/PrismaFinancialParcelRepository";
import { CreateReceivableUseCase } from "@finance/application/useCases/commands/CreateReceivableUseCase";
export function makeCreateReceivableUseCase() {
  const repository = new PrismaFinancialDocumentRepository();
  const repositoryParcels = new PrismaFinancialParcelRepository();

  const transactionManager = new PrismaTransactionManager();

  return new CreateReceivableUseCase(
    repository,
    repositoryParcels,
    transactionManager,
  );
}
