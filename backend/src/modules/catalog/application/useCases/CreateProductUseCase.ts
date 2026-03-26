// /home/tiago/projects/inventory-system/backend/src/modules/catalog/application/useCases/CreateProduct.ts
import { ProductVariantRepository } from "@catalog/domain/repositories/ProductVariantRepository";
import { Product } from "../../domain/entities/Product";
import { ProductRepository } from "../../domain/repositories/ProductRepository";
import { InventoryRepository } from "@inventory/domain/repositories/InventoryRepository";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { ProductVariant } from "@catalog/domain/entities/ProductVariant";
import { CategoryRepository } from "@catalog/domain/repositories/CategoryRepository";
import { GetBrandById } from "./GetBrandByIdUseCase";

interface CreateProductDTO {
  name: string;
  description?: string;
  brandId: string;
  categoryId: string;
}

export class CreateProduct {
  constructor(
    private geBrandById: GetBrandById,
    private categoryRepo: CategoryRepository,
    private productRepo: ProductRepository,
    private variantRepo: ProductVariantRepository,
    private inventoryRepo: InventoryRepository,
    private transaction: TransactionManager,
  ) {}
  private async generateCode(): Promise<string> {
    const count = await this.variantRepo.count();
    return `P${String(count + 1).padStart(4, "0")}`;
  }
  async execute(data: CreateProductDTO): Promise<Product> {
    return this.transaction.execute(async () => {
      const brandExists = await this.geBrandById.execute(data.brandId);
      if (!brandExists) throw new Error("Brand não encontrada");

      const categoryExists = await this.categoryRepo.findById(data.categoryId);
      if (!categoryExists) throw new Error("Category não encontrada");

      const product = new Product({
        name: data.name,
        description: data.description ?? null, // garante string | null
        brandId: data.brandId,
        categoryId: data.categoryId,
        createdAt: new Date(), // opcional, mas garante compatibilidade
      });
      const createdProduct = await this.productRepo.create(product);
      // 2️⃣ Criar Variant padrão
      const variant = new ProductVariant({
        code: await this.generateCode(),
        productId: createdProduct.id,
        createdAt: new Date(),
        unit: "UN",
      });

      const createdVariant = await this.variantRepo.create(variant);

      // 3️⃣ Criar Inventory inicial
      await this.inventoryRepo.create({
        productVariantId: createdVariant.id,
        quantity: 0,
        reservedQuantity: 0,
        minimumStock: 0,
      });

      return createdProduct;
    });
  }
}
