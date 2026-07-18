import { FinancialParcel } from "../../domain/entities/FinancialParcel";
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
  ): Prisma.FinancialParcelCreateWithoutDocumentInput {
    return {
      id: parcel.id,

      amount: parcel.amount,

      dueDate: parcel.dueDate,

      paidAt: parcel.paidAt,
    };
  }
}
