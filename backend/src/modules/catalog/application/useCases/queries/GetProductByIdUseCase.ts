import { NotFoundError } from "@shared/domain/errors";
import { ProductReadRepository } from "@catalog/application/contracts/ProductReadRepository";
import { ProductDetailDTO } from "@catalog/application/dto/ProductDTO";

export class GetProductByIdUseCase {
  constructor(private productRepo: ProductReadRepository) {}

  async execute(id: string): Promise<ProductDetailDTO> {
    const product = await this.productRepo.getById(id);
    if (!product) throw new NotFoundError("Produto não encontrado.", "PRODUCT_NOT_FOUND");
    return product;
  }
}
