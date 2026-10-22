import { NotFoundError } from "@shared/domain/errors";
import { ProductVariantRepository } from "@catalog/domain/repositories/ProductVariantRepository";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { ProductVariant } from "@catalog/domain/entities/ProductVariant";
import { CategoryRepository } from "@catalog/domain/repositories/CategoryRepository";
import { BrandRepository } from "@catalog/domain/repositories/BrandRepository";
import { NumberGenerator } from "@shared/application/services/NumberGenerator";
import { NumberRangeName } from "@shared/domain/enums/NumberRangeName";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import {
  ICreateProductInput,
  IProductOutput,
} from "@catalog/application/dto/ProductDTO";
import { Product } from "@catalog/domain/entities/Product";
import { ProductRepository } from "@catalog/domain/repositories/ProductRepository";

export class CreateProductUseCase extends TransactionalUseCase<
  ICreateProductInput,
  IProductOutput
> {
  constructor(
    private getBrandById: BrandRepository,
    private categoryRepo: CategoryRepository,
    private productRepo: ProductRepository,
    private variantRepo: ProductVariantRepository,
    private numberGenerator: NumberGenerator,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }
  async handle(
    request: ICreateProductInput,
  ): Promise<IProductOutput> {
    const brandExists = await this.getBrandById.findById(request.brandId);
    if (!brandExists) throw new NotFoundError("Marca não encontrada.", "BRAND_NOT_FOUND");

    const categoryExists = await this.categoryRepo.findById(request.categoryId);
    if (!categoryExists) throw new NotFoundError("Categoria não encontrada.", "CATEGORY_NOT_FOUND");

    const productCode = await this.numberGenerator.generate(
      NumberRangeName.PRODUCT,
      "P",
    );

    const product = new Product({
      code: productCode,
      name: request.name,
      description: request.description ?? null, // garante string | null
      brandId: request.brandId,
      categoryId: request.categoryId,
    });
    const createdProduct = await this.productRepo.create(product);
    // 2️⃣ Criar Variant padrão
    const variantCode = await this.numberGenerator.generate(
      NumberRangeName.PRODUCT_VARIANT,
      "V",
    );

    const variant = new ProductVariant({
      code: variantCode,
      productId: createdProduct.id,
    });

    await this.variantRepo.create(variant);

    return {
      id: createdProduct.id,
      name: createdProduct.name,
      brand_id: createdProduct.brandId,
      category_id: createdProduct.categoryId,
      description: createdProduct?.description,
      code: createdProduct.code,
    };
  }
}
