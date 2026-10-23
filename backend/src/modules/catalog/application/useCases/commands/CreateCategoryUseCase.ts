import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { CategoryDTO, ICreateCategoryInput } from "@catalog/application/dto/CategoryDTO";
import { Category } from "@catalog/domain/entities/Category";
import { categoryAlreadyExists } from "@catalog/domain/errors/brandCategoryErrors";
import { CategoryRepository } from "@catalog/domain/repositories/CategoryRepository";

/**
 * Nome já normalizado pela borda. A checagem dá o 409 amigável; numa corrida, o
 * índice único lower(name) barra a segunda gravação e o repositório devolve o mesmo 409.
 */
export class CreateCategoryUseCase extends TransactionalUseCase<ICreateCategoryInput, CategoryDTO> {
  constructor(
    private repository: CategoryRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(request: ICreateCategoryInput): Promise<CategoryDTO> {
    if (await this.repository.findByName(request.name)) {
      throw categoryAlreadyExists();
    }

    const created = await this.repository.create(new Category({ name: request.name }));

    return { id: created.id, name: created.name, productsCount: 0 };
  }
}
