import { fromCents } from "@shared/domain/money";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import type { SaleFinancingRecord, SaleFinancingRepository } from "@sales/domain/repositories/SaleFinancingRepository";

export class PrismaSaleFinancingRepository implements SaleFinancingRepository {
  async create(record: SaleFinancingRecord): Promise<void> {
    await getDb().saleFinancing.create({
      data: {
        saleId: record.saleId,
        cashPrice: fromCents(record.cashPriceCents),
        downPayment: fromCents(record.downPaymentCents),
        downPaymentMethod: record.downPaymentMethod,
        financedAmount: fromCents(record.financedCents),
        installments: record.installments,
        monthlyRateBps: record.monthlyRateBps,
        surchargeAmount: fromCents(record.surchargeCents),
        totalAmount: fromCents(record.totalCents),
        dueDay: record.dueDay,
        firstDueDate: new Date(`${record.firstDueDate}T00:00:00.000Z`),
        overrideById: record.overrideById,
        overrideReason: record.overrideReason,
        overrideKinds: record.overrideKinds,
        fineBps: record.fineBps,
        monthlyInterestBps: record.monthlyInterestBps,
        graceDays: record.graceDays,
      },
    });
  }
}
