import { FinancialType } from "@finance/domain/enums/FinancialType";
import { ListFinancialDocumentsUseCase } from "@finance/application/useCases/queries/ListFinancialDocumentsUseCase";
import { ExportFinancialParcelsUseCase } from "@finance/application/useCases/queries/ExportFinancialParcelsUseCase";
import { GetFinancialDocumentByIdUseCase } from "@finance/application/useCases/queries/GetFinancialDocumentByIdUseCase";
import { PrismaFinancialDocumentReadRepository } from "@finance/infrastructure/prisma/contracts/PrismaFinancialDocumentReadRepository";

export function makeListFinancialDocumentsUseCase<T extends FinancialType>(type: T) {
  return new ListFinancialDocumentsUseCase(type, new PrismaFinancialDocumentReadRepository());
}

export function makeGetFinancialDocumentByIdUseCase<T extends FinancialType>(type: T) {
  return new GetFinancialDocumentByIdUseCase(type, new PrismaFinancialDocumentReadRepository());
}

export function makeExportFinancialParcelsUseCase<T extends FinancialType>(type: T) {
  return new ExportFinancialParcelsUseCase(type, new PrismaFinancialDocumentReadRepository());
}
