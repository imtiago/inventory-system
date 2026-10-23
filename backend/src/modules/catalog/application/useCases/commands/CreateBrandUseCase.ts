import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { BrandDTO, ICreateBrandInput } from "@catalog/application/dto/BrandDTO";
import { Brand } from "@catalog/domain/entities/Brand";
import { brandAlreadyExists } from "@catalog/domain/errors/brandCategoryErrors";
import { BrandRepository } from "@catalog/domain/repositories/BrandRepository";

/**
 * Nome já normalizado pela borda. A checagem dá o 409 amigável; numa corrida, o
 * índice único lower(name) barra a segunda gravação e o repositório devolve o mesmo 409.
 */
export class CreateBrandUseCase extends TransactionalUseCase<ICreateBrandInput, BrandDTO> {
  constructor(
    private repository: BrandRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(request: ICreateBrandInput): Promise<BrandDTO> {
    if (await this.repository.findByName(request.name)) {
      throw brandAlreadyExists();
    }

    const created = await this.repository.create(new Brand({ name: request.name }));

    return { id: created.id, name: created.name, productsCount: 0 };
  }
}
