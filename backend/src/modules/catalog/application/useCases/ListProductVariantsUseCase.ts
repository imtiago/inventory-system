import { ProductRepository } from "@catalog/domain/repositories/ProductRepository";
import { ProductVariantRepository } from "@catalog/domain/repositories/ProductVariantRepository";

export class ListProductVariantsUseCase {
  constructor(
    private productRepository: ProductRepository,
    private variantRepository: ProductVariantRepository,
  ) {}

  async execute(productId: string) {
    const product = await this.productRepository.findById(productId);

    if (!product) {
      throw new Error("Product not found");
    }

    return this.variantRepository.findByProduct(productId);
  }
}
