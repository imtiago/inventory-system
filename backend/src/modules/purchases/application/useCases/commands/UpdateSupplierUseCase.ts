import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { IUpdateSupplierInput, SupplierDTO } from "@purchases/application/dto/SupplierDTO";
import { SupplierReadMapper } from "@purchases/application/mappers/SupplierReadMapper";
import { supplierDocumentAlreadyExists, supplierNotFound } from "@purchases/domain/errors/supplierErrors";
import { SupplierRepository } from "@purchases/domain/repositories/SupplierRepository";

export class UpdateSupplierUseCase extends TransactionalUseCase<IUpdateSupplierInput, SupplierDTO> {
  constructor(
    private supplierRepo: SupplierRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle({ id, ...patch }: IUpdateSupplierInput): Promise<SupplierDTO> {
    const existing = await this.supplierRepo.findById(id);
    if (!existing) throw supplierNotFound();

    if (patch.document !== undefined && patch.document !== existing.document) {
      const other = await this.supplierRepo.findByDocument(patch.document);
      if (other && other.id !== id) throw supplierDocumentAlreadyExists();
    }

    const updated = await this.supplierRepo.update(id, patch);
    return SupplierReadMapper.toDTO(updated);
  }
}
