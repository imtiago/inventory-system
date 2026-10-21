import { ProductVariantRepository } from "@catalog/domain/repositories/ProductVariantRepository";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { ProductVariant } from "@catalog/domain/entities/ProductVariant";
import { CategoryRepository } from "@catalog/domain/repositories/CategoryRepository";
import { BrandRepository } from "@catalog/domain/repositories/BrandRepository";
import { NumberGenerator } from "@shared/application/services/NumberGenerator";
import { NumberRangeName } from "@shared/domain/enums/NumberRangeName";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { ICreateProductInput } from "@catalog/application/dto/ProductDTO";
import { Product } from "@catalog/domain/entities/Product";
import { ProductRepository } from "@catalog/domain/repositories/ProductRepository";

export class CreateProductUseCase extends TransactionalUseCase<
  ICreateProductInput,
  Product
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
    tx: Prisma.TransactionClient,
  ): Promise<Product> {
    const brandExists = await this.getBrandById.findById(request.brandId);
    if (!brandExists) throw new Error("Brand não encontrada");

    const categoryExists = await this.categoryRepo.findById(request.categoryId);
    if (!categoryExists) throw new Error("Category não encontrada");

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

    return createdProduct;
  }
}
