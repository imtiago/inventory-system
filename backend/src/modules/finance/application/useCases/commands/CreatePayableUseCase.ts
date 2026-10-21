import { ICreatePayableInput } from "@finance/application/dto/PayableDTO";
import { Prisma } from "@prisma/client";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { Payable } from "modules/finance/domain/entities/Payable";
import { PayableRepository } from "modules/finance/domain/repositories/PayableRepository";

export class CreatePayableUseCase extends TransactionalUseCase<
  ICreatePayableInput,
  Payable
> {
  constructor(
    private repo: PayableRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: ICreatePayableInput,
    tx: Prisma.TransactionClient,
  ): Promise<Payable> {
    const payable: Payable = {
      id: crypto.randomUUID(),
      purchaseId: request.purchaseId,
      totalAmount: request.totalAmount,
      createdAt: new Date(),
      parcels: request.parcels.map((p) => ({
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
