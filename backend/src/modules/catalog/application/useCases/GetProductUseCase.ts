import { ProductRepository } from "../../domain/repositories/ProductRepository";
import { Product } from "../../domain/entities/Product";

export class GetProductUseCase {
  constructor(private productRepo: ProductRepository) {}

  async execute(id: string): Promise<Product | null> {
    return this.productRepo.getById(id);
  }
}
