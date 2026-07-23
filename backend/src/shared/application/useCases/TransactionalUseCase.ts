import { Prisma } from "@prisma/client";
import { UseCase } from "@shared/domain/UseCase";
import { TransactionManager } from "@shared/domain/TransactionManager";

export abstract class TransactionalUseCase<
  Request,
  Response,
> implements UseCase<Request, Response> {
  constructor(protected readonly transactionManager: TransactionManager) {}

  async execute(
    request: Request,
    transaction?: Prisma.TransactionClient,
  ): Promise<Response> {
    if (transaction) {
      return this.handle(request, transaction);
    }

    return this.transactionManager.execute(async (newTx) => {
      return this.handle(request, newTx);
    });
  }
  protected abstract handle(
    request: Request,
    tx: Prisma.TransactionClient,
  ): Promise<Response>;
}
