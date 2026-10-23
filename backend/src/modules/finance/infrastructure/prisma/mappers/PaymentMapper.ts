import { Payment } from "@finance/domain/entities/Payment";
import { PaymentMethod } from "@finance/domain/enums/PaymentMethod";
import { fromDateOnly, toDateOnly } from "@finance/domain/services/receivableStatus";
import { fromCents, toCents } from "@shared/domain/money";
import { Payment as PrismaPayment, Prisma } from "@prisma/client";

export class PaymentMapper {
  static toDomain(prisma: PrismaPayment): Payment {
    return new Payment({
      id: prisma.id,
      parcelId: prisma.parcelId,
      amountCents: toCents(Number(prisma.amount)),
      method: prisma.method as PaymentMethod,
      reference: prisma.reference,
      paymentDate: toDateOnly(prisma.paymentDate),
      createdById: prisma.createdById,
      createdAt: prisma.createdAt,
      reversedAt: prisma.reversedAt,
      reversedById: prisma.reversedById,
      reversalReason: prisma.reversalReason,
    });
  }

  static toCreatePersistence(payment: Payment): Prisma.PaymentUncheckedCreateInput {
    return {
      id: payment.id,
      parcelId: payment.parcelId,
      amount: fromCents(payment.amountCents),
      method: payment.method,
      reference: payment.reference,
      paymentDate: fromDateOnly(payment.paymentDate),
      createdById: payment.createdById,
      createdAt: payment.createdAt,
    };
  }

  /** Só o estorno é mutável. */
  static toReversalPersistence(payment: Payment): Prisma.PaymentUncheckedUpdateInput {
    return {
      reversedAt: payment.reversedAt,
      reversedById: payment.reversedById,
      reversalReason: payment.reversalReason,
    };
  }
}
