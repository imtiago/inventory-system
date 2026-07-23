import { TransactionManager } from "@shared/domain/TransactionManager";
import { ProductRepository } from "../../domain/repositories/ProductRepository";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
interface Input {
  productId: string;
}

export class DeleteProductUseCase extends TransactionalUseCase<Input, void> {
  constructor(
    private repository: ProductRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(request: Input, tx: Prisma.TransactionClient): Promise<void> {
    const existing = await this.repository.findById(request.productId);
    if (!existing) throw new Error("Produto não encontrado");

    await this.repository.delete(request.productId);
  }
}
