import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";
import { CreateReceivable } from "@finance/application/useCases/CreateReceivable";
import { PrismaFinancialDocumentRepository } from "@finance/infrastructure/repositories/PrismaFinancialDocumentRepository";
export function makeCreateReceivableUseCase() {
  const repository = new PrismaFinancialDocumentRepository();

  const transactionManager = new PrismaTransactionManager();

  return new CreateReceivable(repository, transactionManager);
}
