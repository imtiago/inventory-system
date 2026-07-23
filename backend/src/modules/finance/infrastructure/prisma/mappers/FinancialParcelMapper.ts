import { FinancialParcel } from "@finance/domain/entities/FinancialParcel";
import {
  FinancialParcel as PrismaFinancialParcel,
  Prisma,
} from "@prisma/client";

export class FinancialParcelMapper {
  static toDomain(prisma: PrismaFinancialParcel): FinancialParcel {
    return new FinancialParcel({
      id: prisma.id,

      amount: Number(prisma.amount),

      dueDate: prisma.dueDate,

      paidAt: prisma.paidAt,
    });
  }

  static toCreatePersistence(
    parcel: FinancialParcel,
  ): Prisma.FinancialParcelCreateManyInput {
    return {
      id: parcel.id,
      amount: parcel.amount,
      dueDate: parcel.dueDate,
      financialDocumentId: parcel.financialDocumentId,
    };
  }
}
