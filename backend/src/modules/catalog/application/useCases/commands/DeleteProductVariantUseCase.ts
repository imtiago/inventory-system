import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { ProductVariantRepository } from "@catalog/domain/repositories/ProductVariantRepository";
import { IDeleteProductVariantInput } from "@catalog/application/dto/ProductVariantDTO";

export class DeleteProductVariantUseCase extends TransactionalUseCase<
  IDeleteProductVariantInput,
  void
> {
  constructor(
    private repository: ProductVariantRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: IDeleteProductVariantInput,
  ): Promise<void> {
    const existing = await this.repository.findById(request.id);
    if (!existing) throw new Error("Variante do produto não encontrado");

    await this.repository.delete(request.id);
  }
}
