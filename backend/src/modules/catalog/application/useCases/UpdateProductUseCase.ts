// modules/inventory/application/useCases/updateProduct.ts

import { Product } from "@catalog/domain/entities/Product";
import { ProductRepository } from "@catalog/domain/repositories/ProductRepository";
import { Prisma } from "@prisma/client";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { TransactionManager } from "@shared/domain/TransactionManager";

interface UpdateProductRequest {
  id: string;
}

export class UpdateProductUseCase extends TransactionalUseCase<
  UpdateProductRequest,
  Product
> {
  constructor(
    private productRepository: ProductRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: UpdateProductRequest,
    tx: Prisma.TransactionClient,
  ): Promise<Product> {
    // 1. Verificar se o produto existe
    const existing = await this.productRepository.findById(request.id);
    if (!existing) {
      throw new Error("Produto não encontrado");
    }

    // 2. Atualizar produto
    return await this.productRepository.update(request.id, request);
  }
}
