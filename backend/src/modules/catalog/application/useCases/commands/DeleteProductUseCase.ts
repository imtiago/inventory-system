import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { IDeleteProductInput } from "@catalog/application/dto/ProductDTO";
import { ProductRepository } from "@catalog/domain/repositories/ProductRepository";

export class DeleteProductUseCase extends TransactionalUseCase<
  IDeleteProductInput,
  void
> {
  constructor(
    private repository: ProductRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: IDeleteProductInput,
  ): Promise<void> {
    const existing = await this.repository.findById(request.id);
    if (!existing) throw new Error("Produto não encontrado");

    await this.repository.delete(request.id);
  }
}
