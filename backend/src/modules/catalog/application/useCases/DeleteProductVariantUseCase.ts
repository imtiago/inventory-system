import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { ProductVariantRepository } from "@catalog/domain/repositories/ProductVariantRepository";
interface Input {
  productVariantId: string;
}

export class DeleteProductVariantUseCase extends TransactionalUseCase<
  Input,
  void
> {
  constructor(
    private repository: ProductVariantRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(request: Input, tx: Prisma.TransactionClient): Promise<void> {
    const existing = await this.repository.findById(request.productVariantId);
    if (!existing) throw new Error("Variante do produto não encontrado");

    await this.repository.delete(request.productVariantId);
  }
}
