import {
  FinancialDocument as PrismaFinancialDocument,
  FinancialParcel as PrismaFinancialParcel,
  Prisma,
} from "@prisma/client";
import { FinancialType } from "@finance/domain/enums/FinancialType";
import { FinancialOriginType } from "@finance/domain/enums/FinancialOriginType";
import { FinancialPartyType } from "@finance/domain/enums/FinancialPartyType";
import { FinancialStatus } from "@finance/domain/enums/FinancialStatus";
import { FinancialParcelMapper } from "./FinancialParcelMapper";
import { FinancialDocument } from "@finance/domain/entities/FinancialDocument";

export class FinancialDocumentMapper {
  static toDomain(
    prisma: PrismaFinancialDocument & {
      parcels?: PrismaFinancialParcel[];
    },
  ): FinancialDocument {
    return new FinancialDocument({
      id: prisma.id,
      type: prisma.type as FinancialType,
      originId: prisma.originId,
      originType: prisma.originType as FinancialOriginType,
      partyId: prisma.partyId,
      partyType: prisma.partyType as FinancialPartyType,
      status: prisma.status as FinancialStatus,
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
      status: document.status,
    };
  }
}
