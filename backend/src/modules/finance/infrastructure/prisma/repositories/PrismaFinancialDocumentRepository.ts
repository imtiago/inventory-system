import { FinancialDocument } from "@finance/domain/entities/FinancialDocument";
import { FinancialDocumentRepository } from "@finance/domain/repositories/FinancialDocumentRepository";
import { prisma } from "@shared/prisma";
import { FinancialDocumentMapper } from "../mappers/FinancialDocumentMapper";

export class PrismaFinancialDocumentRepository implements FinancialDocumentRepository {
  async create(data: FinancialDocument, tx = prisma) {
    const receivable = await tx.financialDocument.create({
      data: FinancialDocumentMapper.toCreatePersistence(data),
    });

    return FinancialDocumentMapper.toDomain(receivable);
  }
}
