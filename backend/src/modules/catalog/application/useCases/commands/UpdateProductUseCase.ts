import {
  IProductOutput,
  IUpdateProductInput,
} from "@catalog/application/dto/ProductDTO";
import { Product } from "@catalog/domain/entities/Product";
import { ProductRepository } from "@catalog/domain/repositories/ProductRepository";
import { Prisma } from "@prisma/client";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { TransactionManager } from "@shared/domain/TransactionManager";

export class UpdateProductUseCase extends TransactionalUseCase<
  IUpdateProductInput,
  IProductOutput
> {
  constructor(
    private productRepository: ProductRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: IUpdateProductInput,
    tx: Prisma.TransactionClient,
  ): Promise<IProductOutput> {
    // 1. Verificar se o produto existe
    const existing = await this.productRepository.findById(request.id);
    if (!existing) {
      throw new Error("Produto não encontrado");
    }

    // 2. Atualizar produto
    const data = await this.productRepository.update(request.id, request);

    return {
      id: data.id,
      name: data.name,
      brand_id: data.brandId,
      category_id: data.categoryId,
      description: data?.description,
      code: data.code,
    };
  }
}
