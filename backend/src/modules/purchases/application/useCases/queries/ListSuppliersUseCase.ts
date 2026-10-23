import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { SupplierReadRepository } from "@purchases/application/contracts/SupplierReadRepository";
import { SupplierDTO } from "@purchases/application/dto/SupplierDTO";

interface ListSuppliersParams {
  page: number;
  limit: number;
  search?: string;
}

export class ListSuppliersUseCase {
  constructor(private supplierRepo: SupplierReadRepository) {}

  async execute({ page, limit, search }: ListSuppliersParams): Promise<PaginatedResult<SupplierDTO>> {
    return this.supplierRepo.list({ page, limit }, { search });
  }
}
