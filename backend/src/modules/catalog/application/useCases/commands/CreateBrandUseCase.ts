import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import {
  IBrandOutput,
  ICreateBrandInput,
} from "@catalog/application/dto/BrandDTO";
import { Brand } from "@catalog/domain/entities/Brand";
import { BrandRepository } from "@catalog/domain/repositories/BrandRepository";

export class CreateBrandUseCase extends TransactionalUseCase<
  ICreateBrandInput,
  IBrandOutput
> {
  constructor(
    private repository: BrandRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: ICreateBrandInput,
  ): Promise<IBrandOutput> {
    const brand = new Brand({
      name: request.name,
    });

    const data = await this.repository.create(brand);

    return {
      id: data.id,
      name: data.name,
    };
  }
}
