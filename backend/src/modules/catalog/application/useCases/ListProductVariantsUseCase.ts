import { ProductRepository } from "../../domain/repositories/ProductRepository";

export class ListProductVariants {
  constructor(private productRepo: ProductRepository) {}

  async execute(productId: string) {
    return this.productRepo.findVariantsByProductId(productId);
  }
}
