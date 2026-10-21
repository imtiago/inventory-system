import { TransactionManager } from "@shared/domain/TransactionManager";
import { ProductRepository } from "../../../domain/repositories/ProductRepository";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { IDeleteProductInput } from "@catalog/application/dto/ProductDTO";

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
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const existing = await this.repository.findById(request.id);
    if (!existing) throw new Error("Produto não encontrado");

    await this.repository.delete(request.id);
  }
}
