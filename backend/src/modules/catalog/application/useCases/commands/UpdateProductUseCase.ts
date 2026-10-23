import { InternalErrorCodes, InternalInvariantError, NotFoundError } from "@shared/domain/errors";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { ProductReadRepository } from "@catalog/application/contracts/ProductReadRepository";
import { IUpdateProductInput, ProductDetailDTO } from "@catalog/application/dto/ProductDTO";
import { BrandRepository } from "@catalog/domain/repositories/BrandRepository";
import { CategoryRepository } from "@catalog/domain/repositories/CategoryRepository";
import { ProductRepository } from "@catalog/domain/repositories/ProductRepository";

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
    const product = await this.productRepository.findById(request.id);
    if (!product) {
      throw new NotFoundError("Produto não encontrado.", "PRODUCT_NOT_FOUND");
    }

    if (request.brandId !== undefined && request.brandId !== product.brandId) {
      if (!(await this.brandRepository.findById(request.brandId))) {
        throw new NotFoundError("Marca não encontrada.", "BRAND_NOT_FOUND");
      }
      product.changeBrand(request.brandId);
    }

    if (request.categoryId !== undefined && request.categoryId !== product.categoryId) {
      if (!(await this.categoryRepository.findById(request.categoryId))) {
        throw new NotFoundError("Categoria não encontrada.", "CATEGORY_NOT_FOUND");
      }
      product.changeCategory(request.categoryId);
    }

    if (request.name !== undefined) product.rename(request.name);
    if (request.description !== undefined) product.changeDescription(request.description);

    await this.productRepository.update(product);

    const detail = await this.productReadRepository.getById(product.id);
    if (!detail) {
      throw new InternalInvariantError("Produto atualizado não encontrado.", InternalErrorCodes.PRODUCT_READ_AFTER_WRITE);
    }
    return detail;
  }
}
