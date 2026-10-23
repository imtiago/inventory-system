import { InternalErrorCodes, InternalInvariantError, NotFoundError } from "@shared/domain/errors";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { NumberGenerator } from "@shared/application/services/NumberGenerator";
import { NumberRangeName } from "@shared/domain/enums/NumberRangeName";
import { ProductReadRepository } from "@catalog/application/contracts/ProductReadRepository";
import { ICreateProductInput, ProductDetailDTO } from "@catalog/application/dto/ProductDTO";
import { Product } from "@catalog/domain/entities/Product";
import { ProductVariant } from "@catalog/domain/entities/ProductVariant";
import { BrandRepository } from "@catalog/domain/repositories/BrandRepository";
import { CategoryRepository } from "@catalog/domain/repositories/CategoryRepository";
import { ProductRepository } from "@catalog/domain/repositories/ProductRepository";
import { ProductVariantRepository } from "@catalog/domain/repositories/ProductVariantRepository";

export class CreateProductUseCase extends TransactionalUseCase<
  ICreateProductInput,
  ProductDetailDTO
> {
  constructor(
    private brandRepo: BrandRepository,
    private categoryRepo: CategoryRepository,
    private productRepo: ProductRepository,
    private variantRepo: ProductVariantRepository,
    private productReadRepo: ProductReadRepository,
    private numberGenerator: NumberGenerator,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(request: ICreateProductInput): Promise<ProductDetailDTO> {
    if (!(await this.brandRepo.findById(request.brandId))) {
      throw new NotFoundError("Marca não encontrada.", "BRAND_NOT_FOUND");
    }
    if (!(await this.categoryRepo.findById(request.categoryId))) {
      throw new NotFoundError("Categoria não encontrada.", "CATEGORY_NOT_FOUND");
    }

    const productCode = await this.numberGenerator.generate(NumberRangeName.PRODUCT, "P");
    const created = await this.productRepo.create(
      new Product({
        code: productCode,
        name: request.name,
        description: request.description ?? null,
        brandId: request.brandId,
        categoryId: request.categoryId,
      }),
    );

    // Variante padrão: todo produto nasce com uma variante.
    const variantCode = await this.numberGenerator.generate(NumberRangeName.PRODUCT_VARIANT, "V");
    await this.variantRepo.create(new ProductVariant({ code: variantCode, productId: created.id }));

    // Leitura dentro da mesma transação.
    const detail = await this.productReadRepo.getById(created.id);
    if (!detail) {
      throw new InternalInvariantError("Produto recém-criado não encontrado.", InternalErrorCodes.PRODUCT_READ_AFTER_WRITE);
    }
    return detail;
  }
}
