import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { ICreateSupplierInput, SupplierDTO } from "@purchases/application/dto/SupplierDTO";
import { SupplierReadMapper } from "@purchases/application/mappers/SupplierReadMapper";
import { Supplier } from "@purchases/domain/entities/Supplier";
import { supplierDocumentAlreadyExists } from "@purchases/domain/errors/supplierErrors";
import { SupplierRepository } from "@purchases/domain/repositories/SupplierRepository";

export class CreateSupplierUseCase extends TransactionalUseCase<ICreateSupplierInput, SupplierDTO> {
  constructor(
    private supplierRepo: SupplierRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(request: ICreateSupplierInput): Promise<SupplierDTO> {
    if (await this.supplierRepo.findByDocument(request.document)) throw supplierDocumentAlreadyExists();

    const created = await this.supplierRepo.create(new Supplier(request));
    return SupplierReadMapper.toDTO(created);
  }
}
