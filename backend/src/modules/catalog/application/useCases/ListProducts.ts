import { ProductRepository } from "../../domain/repositories/ProductRepository";

export class ListProducts {
  constructor(private productRepo: ProductRepository) {}

  async execute(page?: number, limit?: number) {
    return this.productRepo.findAll(page, limit);
  }
}
