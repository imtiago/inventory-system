import { FinancialParcel } from "@finance/domain/entities/FinancialParcel";
import { fromDateOnly, toDateOnly } from "@finance/domain/services/receivableStatus";
import { fromCents, toCents } from "@shared/domain/money";
import {
  FinancialParcel as PrismaFinancialParcel,
  Payment as PrismaPayment,
  Prisma,
} from "@prisma/client";
import { PaymentMapper } from "./PaymentMapper";

export class FinancialParcelMapper {
  static toDomain(prisma: PrismaFinancialParcel & { payments?: PrismaPayment[] }): FinancialParcel {
    return new FinancialParcel({
      id: prisma.id,
      amountCents: toCents(Number(prisma.amount)),
      dueDate: toDateOnly(prisma.dueDate),
      financialDocumentId: prisma.financialDocumentId,
      createdAt: prisma.createdAt,
      payments: prisma.payments?.map((p) => PaymentMapper.toDomain(p)) ?? [],
    });
  }

  static toCreatePersistence(parcel: FinancialParcel): Prisma.FinancialParcelCreateManyInput {
    return {
      id: parcel.id,
      amount: fromCents(parcel.amountCents),
      dueDate: fromDateOnly(parcel.dueDate),
      financialDocumentId: parcel.financialDocumentId,
    };
  }
}
