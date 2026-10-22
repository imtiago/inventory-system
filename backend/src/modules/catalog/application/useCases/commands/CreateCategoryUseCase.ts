import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import {
  ICategoryOutput,
  ICreateCategoryInput,
} from "@catalog/application/dto/CategoryDTO";
import { CategoryRepository } from "@catalog/domain/repositories/CategoryRepository";
import { Category } from "@catalog/domain/entities/Category";

export class CreateCategoryUseCase extends TransactionalUseCase<
  ICreateCategoryInput,
  ICategoryOutput
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
  ): Promise<ICategoryOutput> {
    const category = new Category({ name: request.name });

    const data = await this.repository.create(category);

    return {
      id: data.id,
      name: data.name,
    };
  }
}
