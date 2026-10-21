import { ProductReadRepository } from "@catalog/application/contracts/ProductReadRepository";
import { ProductDTO } from "@catalog/application/dto/ProductDTO";

export class GetProductByIdUseCase {
  constructor(private productRepo: ProductReadRepository) {}

  async execute(id: string): Promise<ProductDTO | null> {
    return this.productRepo.getById(id);
  }
}
