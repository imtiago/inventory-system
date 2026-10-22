// src/modules/catalog/application/useCases/CreateBrand.ts
import { BrandRepository } from "../../../domain/repositories/PurchaseRepository";
import { Brand } from "../../domain/entities/Brand";
import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";

interface CreateBrandRequest {
  name: string;
}
export class CreateBrandUseCase extends TransactionalUseCase<
  CreateBrandRequest,
  Brand
> {
  constructor(
    private repository: BrandRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: CreateBrandRequest
  ): Promise<Brand> {
    const brand = new Brand({
      name: request.name,
    });

    return this.repository.create(brand);
  }
}
