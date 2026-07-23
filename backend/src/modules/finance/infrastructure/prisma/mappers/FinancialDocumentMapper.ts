import {
  FinancialDocument as PrismaFinancialDocument,
  Prisma,
} from "@prisma/client";
import { FinancialParcelMapper } from "./FinancialParcelMapper";
import { FinancialDocument } from "@finance/domain/entities/FinancialDocument";

export class FinancialDocumentMapper {
  static toDomain(
    prisma: PrismaFinancialDocument & {
      parcels?: any[];
    },
  ): FinancialDocument {
    return new FinancialDocument({
      id: prisma.id,

      type: prisma.type,

      referenceId: prisma.referenceId,

      customerId: prisma.customerId,

      supplierId: prisma.supplierId,

      createdAt: prisma.createdAt,

      parcels: prisma.parcels?.map(FinancialParcelMapper.toDomain) ?? [],
    });
  }

  static toCreatePersistence(
    document: FinancialDocument,
  ): Prisma.FinancialDocumentCreateInput {
    return {
      id: document.id,
      type: document.type,
      createdAt: document.createdAt,
      originId: document.originId,
      originType: document.originType,
      partyId: document.partyId,
      partyType: document.partyType,
    };
  }

  static toUpdatePersistence(
    document: FinancialDocument,
  ): Prisma.FinancialDocumentUpdateInput {
    return {
      type: document.type,

      customerId: document.customerId,

      supplierId: document.supplierId,
    };
  }
}
