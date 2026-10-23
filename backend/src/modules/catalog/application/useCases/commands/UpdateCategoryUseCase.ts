import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { CategoryReadRepository } from "@catalog/application/contracts/CategoryReadRepository";
import { CategoryDTO, IUpdateCategoryInput } from "@catalog/application/dto/CategoryDTO";
import { categoryAlreadyExists, categoryNotFound } from "@catalog/domain/errors/brandCategoryErrors";
import { CategoryRepository } from "@catalog/domain/repositories/CategoryRepository";

/** Renomeia; trocar só a caixa do próprio nome é permitido. */
export class UpdateCategoryUseCase extends TransactionalUseCase<IUpdateCategoryInput, CategoryDTO> {
  constructor(
    private repository: CategoryRepository,
    private readRepository: CategoryReadRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(request: IUpdateCategoryInput): Promise<CategoryDTO> {
    const category = await this.repository.findById(request.id);
    if (!category) throw categoryNotFound();

    const sameName = await this.repository.findByName(request.name);
    if (sameName && sameName.id !== category.id) throw categoryAlreadyExists();

    category.rename(request.name);
    await this.repository.update(category);

    const detail = await this.readRepository.getById(category.id);
    if (!detail) {
      throw new InternalInvariantError(
        "Categoria atualizada não encontrada.",
        InternalErrorCodes.CATALOG_READ_AFTER_WRITE,
      );
    }
    return detail;
  }
}
