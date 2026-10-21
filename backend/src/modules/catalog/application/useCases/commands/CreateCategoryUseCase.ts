import { CategoryRepository } from "../../../domain/repositories/CategoryRepository";
import { Category } from "../../../domain/entities/Category";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { ICreateCategoryInput } from "@catalog/application/dto/CategoriesDTO";

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
