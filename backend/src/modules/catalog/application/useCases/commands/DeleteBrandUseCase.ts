import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { IDeleteBrandInput } from "@catalog/application/dto/BrandDTO";
import { brandInUse, brandNotFound } from "@catalog/domain/errors/brandCategoryErrors";
import { BrandRepository } from "@catalog/domain/repositories/BrandRepository";

/**
 * Exclui a marca só se nenhum produto a usar. A linha fica travada (FOR UPDATE)
 * durante a contagem: um produto criado/movido para ela em paralelo espera a
 * trava e depois falha na FK (→ 409 RESOURCE_IN_USE), em vez de ficar órfão.
 */
export class DeleteBrandUseCase extends TransactionalUseCase<IDeleteBrandInput, void> {
  constructor(
    private repository: BrandRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(request: IDeleteBrandInput): Promise<void> {
    if (!(await this.repository.lockById(request.id))) throw brandNotFound();

    if ((await this.repository.countProducts(request.id)) > 0) throw brandInUse();

    await this.repository.delete(request.id);
  }
}
