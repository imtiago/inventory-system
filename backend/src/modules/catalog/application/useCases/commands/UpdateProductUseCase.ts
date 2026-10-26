import { InternalErrorCodes, InternalInvariantError, NotFoundError } from "@shared/domain/errors";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { ProductReadRepository } from "@catalog/application/contracts/ProductReadRepository";
import { IUpdateProductInput, ProductDetailDTO } from "@catalog/application/dto/ProductDTO";
import { BrandRepository } from "@catalog/domain/repositories/BrandRepository";
import { CategoryRepository } from "@catalog/domain/repositories/CategoryRepository";
import { ProductRepository, ProductUpdatableField } from "@catalog/domain/repositories/ProductRepository";

/** Edição parcial: só os campos informados mudam. */
export class UpdateProductUseCase extends TransactionalUseCase<
  IUpdateProductInput,
  ProductDetailDTO
> {
  constructor(
    private productRepository: ProductRepository,
    private brandRepository: BrandRepository,
    private categoryRepository: CategoryRepository,
    private productReadRepository: ProductReadRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(request: IUpdateProductInput): Promise<ProductDetailDTO> {
    // Trava a linha antes de ler: edições concorrentes se serializam e cada uma grava só o que mudou.
    const exists = await this.productRepository.lockById(request.id);
    const product = exists ? await this.productRepository.findById(request.id) : null;
    if (!product) {
      throw new NotFoundError("Produto não encontrado.", "PRODUCT_NOT_FOUND");
    }

    const changed: ProductUpdatableField[] = [];

    if (request.brandId !== undefined && request.brandId !== product.brandId) {
      if (!(await this.brandRepository.findById(request.brandId))) {
        throw new NotFoundError("Marca não encontrada.", "BRAND_NOT_FOUND");
      }
      product.changeBrand(request.brandId);
      changed.push("brandId");
    }

    if (request.categoryId !== undefined && request.categoryId !== product.categoryId) {
      if (!(await this.categoryRepository.findById(request.categoryId))) {
        throw new NotFoundError("Categoria não encontrada.", "CATEGORY_NOT_FOUND");
      }
      product.changeCategory(request.categoryId);
      changed.push("categoryId");
    }

    if (request.name !== undefined) {
      product.rename(request.name);
      changed.push("name");
    }
    if (request.description !== undefined) {
      product.changeDescription(request.description);
      changed.push("description");
    }

    if (changed.length > 0) await this.productRepository.updateFields(product, changed);

    const detail = await this.productReadRepository.getById(product.id);
    if (!detail) {
      throw new InternalInvariantError("Produto atualizado não encontrado.", InternalErrorCodes.PRODUCT_READ_AFTER_WRITE);
    }
    return detail;
  }
}
