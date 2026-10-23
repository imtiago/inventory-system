import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { nfeImportConfirmed, nfeImportNotFound } from "@nfe-import/domain/errors/nfeImportErrors";
import { NfeImportRepository } from "../../contracts/NfeImportRepository";

/**
 * Descarta um rascunho. A linha fica travada (FOR UPDATE): uma confirmação em paralelo
 * espera e então vê o rascunho apagado, ou o descarte espera e vê CONFIRMED (409).
 */
export class DiscardNfeImportUseCase extends TransactionalUseCase<{ id: string }, void> {
  constructor(
    private repo: NfeImportRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle({ id }: { id: string }): Promise<void> {
    const locked = await this.repo.lockById(id);
    if (!locked) throw nfeImportNotFound();
    if (locked.status !== "DRAFT") throw nfeImportConfirmed();
    await this.repo.delete(id);
  }
}
