import { Payment } from "@finance/domain/entities/Payment";
import { PaymentRepository } from "@finance/domain/repositories/PaymentRepository";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { PaymentMapper } from "../mappers/PaymentMapper";

export class PrismaPaymentRepository implements PaymentRepository {
  async create(payment: Payment): Promise<void> {
    await getDb().payment.create({ data: PaymentMapper.toCreatePersistence(payment) });
  }

  async saveReversal(payment: Payment): Promise<void> {
    await getDb().payment.update({
      where: { id: payment.id },
      data: PaymentMapper.toReversalPersistence(payment),
    });
  }

  async findDocumentId(paymentId: string): Promise<string | null> {
    const row = await getDb().payment.findUnique({
      where: { id: paymentId },
      select: { parcel: { select: { financialDocumentId: true } } },
    });
    return row?.parcel.financialDocumentId ?? null;
  }
}
