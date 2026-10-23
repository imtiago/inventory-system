import { ProductVariantReadRepository } from "@catalog/application/contracts/ProductVariantReadRepository";
import { ProductVariantDTO } from "@catalog/application/dto/ProductVariantDTO";

export class GetProductVariantByIdUseCase {
  constructor(private productVariantRepo: ProductVariantReadRepository) {}

  async execute(id: string): Promise<ProductVariantDTO | null> {
    return this.productVariantRepo.getById(id);
  }
}
