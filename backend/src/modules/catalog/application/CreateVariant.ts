import { ProductVariant } from "../domain/entities/ProductVariant";
import { ProductRepository } from "../domain/repositories/ProductRepository";
import { InventoryRepository } from "../../inventory/domain/repositories/InventoryRepository";

export class CreateVariant {
  constructor(
    private productRepo: ProductRepository,
    private inventoryRepo: InventoryRepository,
  ) {}

  async execute(data: {
    productId: string;
    name: string;
    sku: string;
    initialQuantity?: number;
  }): Promise<ProductVariant> {
    // 1️⃣ Cria a variante do produto
    const variant = await this.productRepo.createVariant(
      new ProductVariant({
        productId: data.productId,
        name: data.name,
        sku: data.sku,
      }),
    );

    // 2️⃣ Cria o inventário inicial da variante
    await this.inventoryRepo.create({
      productVariantId: variant.id!,
      quantity: data.initialQuantity ?? 0,
      reservedQuantity: 0,
      minimumStock: 0,
    });

    return variant;
  }
}
