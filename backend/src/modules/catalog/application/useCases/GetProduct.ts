import { ProductRepository } from "../../domain/repositories/ProductRepository";
import { Product } from "../../domain/entities/Product";

export class GetProduct {
  constructor(private productRepo: ProductRepository) {}

  async execute(id: string): Promise<Product | null> {
    return this.productRepo.getById(id);
  }
}
