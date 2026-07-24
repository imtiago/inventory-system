import { ProductVariantReadRepository } from "../contracts/ProductVariantReadRepository";
import { ProductVariantDTO } from "../dto/ProductVariantDTO";

export class GetProductVariantByIdUseCase {
  constructor(private productVariantRepo: ProductVariantReadRepository) {}

  async execute(id: string): Promise<ProductVariantDTO | null> {
    return this.productVariantRepo.getById(id);
  }
}
