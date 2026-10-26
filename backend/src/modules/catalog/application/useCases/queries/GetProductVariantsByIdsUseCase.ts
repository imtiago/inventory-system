import { ProductVariantReadRepository } from "@catalog/application/contracts/ProductVariantReadRepository";
import { ProductVariantDTO } from "@catalog/application/dto/ProductVariantDTO";

export class GetProductVariantsByIdsUseCase {
  constructor(private productVariantRepo: ProductVariantReadRepository) {}

  async execute(ids: string[]): Promise<ProductVariantDTO[]> {
    return this.productVariantRepo.getByIds([...new Set(ids)]);
  }
}
