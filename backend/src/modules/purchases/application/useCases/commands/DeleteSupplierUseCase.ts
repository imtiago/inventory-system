import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { supplierInUse, supplierNotFound } from "@purchases/domain/errors/supplierErrors";
import { SupplierRepository } from "@purchases/domain/repositories/SupplierRepository";

/**
 * Exclui o fornecedor só se não houver pedidos. A linha fica travada (FOR UPDATE)
 * durante a contagem: um pedido criado em paralelo espera a trava e depois falha
 * na FK, em vez de ficar órfão.
 */
export class DeleteSupplierUseCase extends TransactionalUseCase<{ id: string }, void> {
  constructor(
    private supplierRepo: SupplierRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle({ id }: { id: string }): Promise<void> {
    if (!(await this.supplierRepo.lockById(id))) throw supplierNotFound();
    if ((await this.supplierRepo.countPurchases(id)) > 0) throw supplierInUse();
    await this.supplierRepo.delete(id);
  }
}
