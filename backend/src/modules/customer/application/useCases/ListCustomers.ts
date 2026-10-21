import { PaginationParams } from "@shared/application/pagination";
import { CustomerReadRepository } from "../contracts/CustomerReadRepository";
import { CustomerDetailsDTO } from "../dto/CustomerDetailsDTO";

interface ListCustomersParams extends PaginationParams {
  search?: string;
}

export class ListCustomers {
  constructor(private customerRepo: CustomerReadRepository) {}

  async execute({
    page,
    limit,
    search,
  }: ListCustomersParams): Promise<CustomerDetailsDTO[]> {
    return this.customerRepo.list(
      {
        page,
        limit,
      },
      { search },
    );
  }
}
