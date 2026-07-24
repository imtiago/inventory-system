import { ProductRepository } from "@catalog/domain/repositories/ProductRepository";
import { ProductVariantReadRepository } from "../contracts/ProductVariantReadRepository";
import { PaginationParams } from "@shared/application/pagination";

interface ListProductVariantsUseCaseInput extends PaginationParams {
  productId: string;
}
export class ListProductVariantsUseCase {
  constructor(
    private productRepository: ProductRepository,
    private variantRepository: ProductVariantReadRepository,
  ) {}

  async execute({ productId, page, limit }: ListProductVariantsUseCaseInput) {
    const product = await this.productRepository.findById(productId);

    if (!product) {
      throw new Error("Product not found");
    }

    return this.variantRepository.getByProductId(productId, { limit, page });
  }
}
