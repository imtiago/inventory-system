import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
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
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const existing = await this.repository.findById(request.id);
    if (!existing) throw new Error("Variante do produto não encontrado");

    await this.repository.delete(request.id);
  }
}
