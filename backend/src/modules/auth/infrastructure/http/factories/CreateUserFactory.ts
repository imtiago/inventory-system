import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { CreateReceivable } from "@finance/application/useCases/CreateReceivable";
import { PrismaFinancialDocumentRepository } from "@finance/infrastructure/prisma/repositories/PrismaFinancialDocumentRepository";
import { PrismaFinancialParcelRepository } from "@finance/infrastructure/prisma/repositories/PrismaFinancialParcelRepository";
export function makeCreateReceivableUseCase() {
  const repository = new PrismaFinancialDocumentRepository();
  const repositoryParcels = new PrismaFinancialParcelRepository();

  const transactionManager = new PrismaTransactionManager();

  return new CreateReceivable(
    repository,
    repositoryParcels,
    transactionManager,
  );
}
