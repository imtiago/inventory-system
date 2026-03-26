import { ProductRepository } from "../../domain/repositories/ProductRepository";
import { ProductVariant } from "../../domain/entities/ProductVariant";
import { v4 as uuidv4 } from "uuid";

interface Input {
  productId: string;
  name: string;
  sku: string;
  barcode?: string;
}

export class CreateVariantUseCase {
  constructor(private productRepo: ProductRepository) {}

  async execute({
    productId,
    name,
    sku,
    barcode,
  }: Input): Promise<ProductVariant> {
    // Verifica se o produto existe
    const product = await this.productRepo.getById(productId);
    if (!product) {
      throw new Error("Product not found");
    }

    // Cria a variante
    const variant: ProductVariant = {
      id: uuidv4(),
      productId,
      name,
      sku,
      barcode,
      createdAt: new Date(),
    };

    return this.productRepo.createVariant(variant);
  }
}
