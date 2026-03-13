// src/modules/payables/application/useCases/CreatePayable.ts

import { Payable } from "@payables/domain/entities/Payable";
import { PayableRepository } from "@payables/domain/repositories/PayableRepository";

export class CreatePayable {
  constructor(private repo: PayableRepository) {}

  async execute(
    purchaseId: string,
    totalAmount: number,
    parcels: { amount: number; dueDate: Date }[],
  ): Promise<Payable> {
    const payable: Payable = {
      id: crypto.randomUUID(),
      purchaseId,
      totalAmount,
      createdAt: new Date(),
      parcels: parcels.map((p) => ({
        id: crypto.randomUUID(),
        payableId: "", // Prisma preenche automaticamente
        amount: p.amount,
        dueDate: p.dueDate,
        paid: false,
      })),
    };
    return this.repo.create(payable);
  }
}
