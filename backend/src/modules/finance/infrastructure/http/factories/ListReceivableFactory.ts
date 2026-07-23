import { ListReceivables } from "@finance/application/useCases/ListReceivables";
import { PrismaFinancialDocumentReadRepository } from "@finance/infrastructure/prisma/contracts/PrismaFinancialDocumentReadRepository";
export function makeListReceivableUseCase() {
  const repository = new PrismaFinancialDocumentReadRepository();

  return new ListReceivables(repository);
}
