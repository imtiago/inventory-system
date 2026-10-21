import { ProductReadRepository } from "../contracts/ProductReadRepository";
import { ProductListDTO } from "../dto/ProductListDTO";

export class GetProductUseCase {
  constructor(private productRepo: ProductReadRepository) {}

  async execute(id: string): Promise<ProductListDTO | null> {
    return this.productRepo.getById(id);
  }
}
