import { ListReceivables } from "@finance/application/useCases/queries/ListReceivablesUseCase";
import { PrismaFinancialDocumentReadRepository } from "@finance/infrastructure/prisma/contracts/PrismaFinancialDocumentReadRepository";
export function makeListReceivableUseCase() {
  const repository = new PrismaFinancialDocumentReadRepository();

  return new ListReceivables(repository);
}
