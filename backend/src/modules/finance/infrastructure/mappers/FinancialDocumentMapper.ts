import { FinancialDocument } from "../../domain/entities/FinancialDocument";
import {
  FinancialDocument as PrismaFinancialDocument,
  Prisma,
} from "@prisma/client";
import { FinancialParcelMapper } from "./FinancialParcelMapper";

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

      referenceId: document.referenceId,

      customerId: document.customerId,

      supplierId: document.supplierId,

      parcels: {
        create: document.parcels.map(FinancialParcelMapper.toCreatePersistence),
      },
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
