import { ConflictError, NotFoundError } from "@shared/domain/errors";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { IDeleteProductInput } from "@catalog/application/dto/ProductDTO";
import { ProductRepository } from "@catalog/domain/repositories/ProductRepository";
import { ProductVariantRepository } from "@catalog/domain/repositories/ProductVariantRepository";

/**
 * Exclui o produto, suas variantes e os registros de estoque zerados — só se
 * nenhuma variante estiver em uso. Produto e variantes ficam travados durante a
 * verificação, então nada novo passa a referenciá-los antes da exclusão.
 */
export class DeleteProductUseCase extends TransactionalUseCase<IDeleteProductInput, void> {
  constructor(
    private productRepository: ProductRepository,
    private variantRepository: ProductVariantRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(request: IDeleteProductInput): Promise<void> {
    if (!(await this.productRepository.lockById(request.id))) {
      throw new NotFoundError("Produto não encontrado.", "PRODUCT_NOT_FOUND");
    }

    const variantIds = await this.variantRepository.lockByProduct(request.id);
    const inUse = await this.variantRepository.findInUse(variantIds);
    if (inUse.length > 0) {
      throw new ConflictError(
        "Produto possui movimentações, vendas ou compras e não pode ser excluído.",
        "PRODUCT_IN_USE",
      );
    }

    await this.variantRepository.deleteWithInventory(variantIds);
    await this.productRepository.delete(request.id);
  }
}
