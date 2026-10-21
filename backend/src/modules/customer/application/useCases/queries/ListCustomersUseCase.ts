import { CustomerReadRepository } from "@customer/application/contracts/CustomerReadRepository";
import { ICustomerDTO } from "@customer/application/dto/CustomerDTO";
import { PaginationParams } from "@shared/application/pagination";

interface ListCustomersParams extends PaginationParams {
  search?: string;
}

export class ListCustomersUseCase {
  constructor(private customerRepo: CustomerReadRepository) {}

  async execute({
    page,
    limit,
    search,
  }: ListCustomersParams): Promise<ICustomerDTO[]> {
    return this.customerRepo.list(
      {
        page,
        limit,
      },
      { search },
    );
  }
}
