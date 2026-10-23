import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { BrandReadRepository } from "@catalog/application/contracts/BrandReadRepository";
import { BrandDTO, IUpdateBrandInput } from "@catalog/application/dto/BrandDTO";
import { brandAlreadyExists, brandNotFound } from "@catalog/domain/errors/brandCategoryErrors";
import { BrandRepository } from "@catalog/domain/repositories/BrandRepository";

/** Renomeia; trocar só a caixa do próprio nome é permitido. */
export class UpdateBrandUseCase extends TransactionalUseCase<IUpdateBrandInput, BrandDTO> {
  constructor(
    private repository: BrandRepository,
    private readRepository: BrandReadRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(request: IUpdateBrandInput): Promise<BrandDTO> {
    const brand = await this.repository.findById(request.id);
    if (!brand) throw brandNotFound();

    const sameName = await this.repository.findByName(request.name);
    if (sameName && sameName.id !== brand.id) throw brandAlreadyExists();

    brand.rename(request.name);
    await this.repository.update(brand);

    const detail = await this.readRepository.getById(brand.id);
    if (!detail) {
      throw new InternalInvariantError(
        "Marca atualizada não encontrada.",
        InternalErrorCodes.CATALOG_READ_AFTER_WRITE,
      );
    }
    return detail;
  }
}
