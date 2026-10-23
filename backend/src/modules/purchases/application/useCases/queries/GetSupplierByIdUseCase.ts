import { SupplierReadRepository } from "@purchases/application/contracts/SupplierReadRepository";
import { SupplierDTO } from "@purchases/application/dto/SupplierDTO";
import { supplierNotFound } from "@purchases/domain/errors/supplierErrors";

export class GetSupplierByIdUseCase {
  constructor(private supplierRepo: SupplierReadRepository) {}

  async execute(id: string): Promise<SupplierDTO> {
    const supplier = await this.supplierRepo.getById(id);
    if (!supplier) throw supplierNotFound();
    return supplier;
  }
}
