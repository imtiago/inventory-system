import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { IDeleteCategoryInput } from "@catalog/application/dto/CategoryDTO";
import { categoryInUse, categoryNotFound } from "@catalog/domain/errors/brandCategoryErrors";
import { CategoryRepository } from "@catalog/domain/repositories/CategoryRepository";

/**
 * Exclui a categoria só se nenhum produto a usar. A linha fica travada (FOR UPDATE)
 * durante a contagem: um produto criado/movido para ela em paralelo espera a
 * trava e depois falha na FK (→ 409 RESOURCE_IN_USE), em vez de ficar órfão.
 */
export class DeleteCategoryUseCase extends TransactionalUseCase<IDeleteCategoryInput, void> {
  constructor(
    private repository: CategoryRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(request: IDeleteCategoryInput): Promise<void> {
    if (!(await this.repository.lockById(request.id))) throw categoryNotFound();

    if ((await this.repository.countProducts(request.id)) > 0) throw categoryInUse();

    await this.repository.delete(request.id);
  }
}
