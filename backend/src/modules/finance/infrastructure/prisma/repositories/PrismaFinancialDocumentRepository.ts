import { FinancialDocument } from "@finance/domain/entities/FinancialDocument";
import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialType } from "@finance/domain/enums/FinancialType";
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

  async findByOrigin(
    type: FinancialType,
    originType: FinancialOriginType,
    originId: string,
  ): Promise<FinancialDocument | null> {
    const document = await getDb().financialDocument.findFirst({
      where: { type, originType, originId },
      include: { parcels: true },
      orderBy: { createdAt: "asc" },
    });

    return document ? FinancialDocumentMapper.toDomain(document) : null;
  }

  async hasPayments(documentId: string): Promise<boolean> {
    const count = await getDb().payment.count({
      where: { parcel: { financialDocumentId: documentId } },
    });

    return count > 0;
  }

  async update(document: FinancialDocument): Promise<FinancialDocument> {
    const updated = await getDb().financialDocument.update({
      where: { id: document.id },
      data: FinancialDocumentMapper.toUpdatePersistence(document),
      include: { parcels: true },
    });

    return FinancialDocumentMapper.toDomain(updated);
  }
}
