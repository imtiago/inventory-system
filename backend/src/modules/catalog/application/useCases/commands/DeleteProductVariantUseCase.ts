import { ConflictError, NotFoundError } from "@shared/domain/errors";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { IDeleteProductVariantInput } from "@catalog/application/dto/ProductVariantDTO";
import { ProductRepository } from "@catalog/domain/repositories/ProductRepository";
import { ProductVariantRepository } from "@catalog/domain/repositories/ProductVariantRepository";

/**
 * Exclui a variante (e o registro de estoque zerado) se não estiver em uso e
 * não for a última do produto. Trava o produto e suas variantes para que duas
 * exclusões simultâneas não deixem o produto sem variante.
 */
export class DeleteProductVariantUseCase extends TransactionalUseCase<
  IDeleteProductVariantInput,
  void
> {
  constructor(
    private variantRepository: ProductVariantRepository,
    private productRepository: ProductRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(request: IDeleteProductVariantInput): Promise<void> {
    const variant = await this.variantRepository.findById(request.id);
    if (!variant) throw new NotFoundError("Variante não encontrada.", "VARIANT_NOT_FOUND");

    await this.productRepository.lockById(variant.productId);
    const siblings = await this.variantRepository.lockByProduct(variant.productId);
    if (!siblings.includes(variant.id)) {
      throw new NotFoundError("Variante não encontrada.", "VARIANT_NOT_FOUND");
    }

    if ((await this.variantRepository.findInUse([variant.id])).length > 0) {
      throw new ConflictError(
        "Variante possui movimentações, vendas ou compras e não pode ser excluída.",
        "VARIANT_IN_USE",
      );
    }

    if (siblings.length <= 1) {
      throw new ConflictError("O produto precisa ter ao menos uma variante.", "LAST_VARIANT");
    }

    await this.variantRepository.deleteWithInventory([variant.id]);
  }
}
