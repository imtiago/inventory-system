import { FinancialDocument } from "@finance/domain/entities/FinancialDocument";
import { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { FinancialDocumentMapper } from "../mappers/FinancialDocumentMapper";

export class PrismaFinancialDocumentRepository implements FinancialDocumentRepository {
  async create(data: FinancialDocument) {
    const receivable = await getDb().financialDocument.create({
      data: FinancialDocumentMapper.toCreatePersistence(data),
    });

    return FinancialDocumentMapper.toDomain(receivable);
  }
}
