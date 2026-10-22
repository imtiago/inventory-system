import { UseCase } from "@shared/domain/UseCase";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";

export abstract class TransactionalUseCase<
  Request,
  Response,
> implements UseCase<Request, Response> {
  constructor(protected readonly transactionManager: TransactionManager) {}

  async execute(request: Request): Promise<Response> {
    return this.transactionManager.execute(() => this.handle(request));
  }

  protected abstract handle(request: Request): Promise<Response>;
}
