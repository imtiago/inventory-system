import { ProductRepository } from "@catalog/domain/repositories/ProductRepository";
import { ProductVariantReadRepository } from "../contracts/ProductVariantReadRepository";

export class ListProductVariantsUseCase {
  constructor(
    private productRepository: ProductRepository,
    private variantRepository: ProductVariantReadRepository,
  ) {}

  async execute(productId: string) {
    const product = await this.productRepository.findById(productId);

    if (!product) {
      throw new Error("Product not found");
    }

    return this.variantRepository.getByProductId(productId);
  }
}
