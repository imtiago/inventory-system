import { Product } from "../../domain/entities/Product";
import { ProductRepository } from "../../domain/repositories/ProductRepository";

export class ListProductsUseCase {
  constructor(private productRepo: ProductRepository) {}

  async execute(page?: number, limit?: number): Promise<Product[]> {
    if (page && limit) {
      return this.productRepo.list(page, limit);
    }
    return this.productRepo.findAll!(); // usa o findAll como fallback
  }
}
