// src/modules/finance/application/mappers/PaymentMapper.ts

import { Payment } from "../../domain/entities/Payment";
import { Payment as PrismaPayment, Prisma } from "@prisma/client";

export class PaymentMapper {
  // Banco -> Domínio
  static toDomain(prisma: PrismaPayment): Payment {
    return new Payment({
      id: prisma.id,
      parcelId: prisma.parcelId,
      amount: Number(prisma.amount),
      method: prisma.method,
      paymentDate: prisma.paymentDate,
    });
  }

  // Domínio -> Banco (Create)
  static toCreatePersistence(payment: Payment): Prisma.PaymentCreateInput {
    return {
      id: payment.id,
      amount: payment.amount,
      method: payment.method,
      paymentDate: payment.paymentDate,

      parcel: {
        connect: {
          id: payment.parcelId,
        },
      },
    };
  }

  // Domínio -> Banco (Update)
  static toUpdatePersistence(payment: Payment): Prisma.PaymentUpdateInput {
    return {
      amount: payment.amount,
      method: payment.method,
      paymentDate: payment.paymentDate,
    };
  }
}
