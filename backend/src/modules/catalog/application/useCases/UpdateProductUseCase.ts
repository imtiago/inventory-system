// modules/inventory/application/useCases/updateProduct.ts

import { Product } from "@catalog/domain/entities/Product";
import { ProductRepository } from "@catalog/domain/repositories/ProductRepository";

export class UpdateProductUseCase {
  constructor(private productRepository: ProductRepository) {}

  async execute(id: string, data: Partial<Product>): Promise<Product> {
    // 1. Verificar se o produto existe
    const existing = await this.productRepository.getById(id);
    if (!existing) {
      throw new Error("Produto não encontrado");
    }

    // 2. Atualizar produto
    return await this.productRepository.update(id, data);
  }
}
