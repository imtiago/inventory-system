import { ProductReadRepository } from "../contracts/ProductReadRepository";

export class ListProductsUseCase {
  constructor(private readonly repository: ProductReadRepository) {}

  async execute() {
    return this.repository.list();
  }
}
