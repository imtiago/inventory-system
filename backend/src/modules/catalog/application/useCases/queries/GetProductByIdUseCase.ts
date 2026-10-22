import { ProductReadRepository } from "@catalog/application/contracts/ProductReadRepository";
import { IProductOutput } from "@catalog/application/dto/ProductDTO";

export class GetProductByIdUseCase {
  constructor(private productRepo: ProductReadRepository) {}

  async execute(id: string): Promise<IProductOutput | null> {
    const data = await this.productRepo.getById(id);
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      brand_id: data.brand_id,
      category_id: data.category_id,
      code: data.code,
      description: data.description,
    };
  }
}
