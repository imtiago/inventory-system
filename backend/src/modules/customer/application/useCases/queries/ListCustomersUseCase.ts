import { CustomerReadRepository } from "@customer/application/contracts/CustomerReadRepository";
import { CustomerDTO } from "@customer/application/dto/CustomerDTO";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";

interface ListCustomersParams {
  page: number;
  limit: number;
  search?: string;
}

export class ListCustomersUseCase {
  constructor(private customerRepo: CustomerReadRepository) {}

  async execute({ page, limit, search }: ListCustomersParams): Promise<PaginatedResult<CustomerDTO>> {
    return this.customerRepo.list({ page, limit }, { search });
  }
}
