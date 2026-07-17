// src/modules/receivables/application/useCases/CreateReceivable.ts

import { Receivable } from "@receivables/domain/entities/Receivable";
import { ReceivableRepository } from "modules/finance/domain/repositories/ReceivableRepository";

export class CreateReceivable {
  constructor(private repo: ReceivableRepository) {}

  async execute(
    saleId: string,
    totalAmount: number,
    parcels: { amount: number; dueDate: Date }[],
  ): Promise<Receivable> {
    const receivable: Receivable = {
      id: crypto.randomUUID(),
      saleId,
      totalAmount,
      createdAt: new Date(),
      parcels: parcels.map((p) => ({
        id: crypto.randomUUID(),
        receivableId: "", // será atualizado pelo Prisma
        amount: p.amount,
        dueDate: p.dueDate,
        paid: false,
      })),
    };
    return this.repo.create(receivable);
  }
}
