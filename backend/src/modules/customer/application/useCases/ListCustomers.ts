import { PaginationParams } from "@shared/application/pagination";
import { CustomerReadRepository } from "../contracts/CustomerReadRepository";
import { CustomerDetailsDTO } from "../dto/CustomerDetailsDTO";

export class ListCustomers {
  constructor(private customerRepo: CustomerReadRepository) {}

  async execute({
    page,
    limit,
  }: PaginationParams): Promise<CustomerDetailsDTO[]> {
    return this.customerRepo.list({
      page,
      limit,
    });
  }
}
