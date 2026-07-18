// /home/tiago/projects/inventory-system/backend/src/modules/catalog/application/useCases/CreateProduct.ts
import { ProductVariantRepository } from "@catalog/domain/repositories/ProductVariantRepository";
import { Product } from "../../domain/entities/Product";
import { ProductRepository } from "../../domain/repositories/ProductRepository";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { ProductVariant } from "@catalog/domain/entities/ProductVariant";
import { CategoryRepository } from "@catalog/domain/repositories/CategoryRepository";
import { BrandRepository } from "@catalog/domain/repositories/BrandRepository";

interface CreateProductDTO {
  name: string;
  description?: string;
  brandId: string;
  categoryId: string;
}

export class CreateProductUseCase {
  constructor(
    private getBrandById: BrandRepository,
    private categoryRepo: CategoryRepository,
    private productRepo: ProductRepository,
    private variantRepo: ProductVariantRepository,
    private transaction: TransactionManager,
  ) {}
  private async generateCode(): Promise<string> {
    const count = await this.variantRepo.count();
    return `P${String(count + 1).padStart(4, "0")}`;
  }
  async execute(data: CreateProductDTO): Promise<Product> {
    return this.transaction.execute(async () => {
      const brandExists = await this.getBrandById.findById(data.brandId);
      if (!brandExists) throw new Error("Brand não encontrada");

      const categoryExists = await this.categoryRepo.findById(data.categoryId);
      if (!categoryExists) throw new Error("Category não encontrada");

      const product = new Product({
        name: data.name,
        description: data.description ?? null, // garante string | null
        brandId: data.brandId,
        categoryId: data.categoryId,
      });
      const createdProduct = await this.productRepo.create(product);
      // 2️⃣ Criar Variant padrão
      const variant = new ProductVariant({
        code: await this.generateCode(),
        productId: createdProduct.id,
      });

      await this.variantRepo.create(variant);

      return createdProduct;
    });
  }
}
