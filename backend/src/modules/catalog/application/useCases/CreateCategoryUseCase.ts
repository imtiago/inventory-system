// src/modules/catalog/application/useCases/CreateCategory.ts
import { CategoryRepository } from "../../domain/repositories/CategoryRepository";
import { Category } from "../../domain/entities/Category";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";

interface CreateCategoryRequest {
  name: string;
}
export class CreateCategoryUseCase extends TransactionalUseCase<
  CreateCategoryRequest,
  Category
> {
  constructor(
    private repository: CategoryRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }
  async handle(
    request: CreateCategoryRequest,
    tx: Prisma.TransactionClient,
  ): Promise<Category> {
    const category = new Category({ name: request.name });
    return this.repository.create(category);
  }
}
