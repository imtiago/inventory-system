import { ListReceivablesUseCase } from "@finance/application/useCases/queries/ListReceivablesUseCase";
import { GetReceivableByIdUseCase } from "@finance/application/useCases/queries/GetReceivableByIdUseCase";
import { PrismaFinancialDocumentReadRepository } from "@finance/infrastructure/prisma/contracts/PrismaFinancialDocumentReadRepository";

export function makeListReceivableUseCase() {
  return new ListReceivablesUseCase(new PrismaFinancialDocumentReadRepository());
}

export function makeGetReceivableByIdUseCase() {
  return new GetReceivableByIdUseCase(new PrismaFinancialDocumentReadRepository());
}
