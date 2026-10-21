import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { ICreateCategoryInput } from "@catalog/application/dto/CategoryDTO";
import { CategoryRepository } from "@catalog/domain/repositories/CategoryRepository";
import { Category } from "@catalog/domain/entities/Category";

export class CreateCategoryUseCase extends TransactionalUseCase<
  ICreateCategoryInput,
  Category
> {
  constructor(
    private repository: CategoryRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }
  async handle(
    request: ICreateCategoryInput,
    tx: Prisma.TransactionClient,
  ): Promise<Category> {
    const category = new Category({ name: request.name });
    return this.repository.create(category);
  }
}
