import { CustomerReadRepository } from "../contracts/CustomerReadRepository";
import { CustomerDetailsDTO } from "../dto/CustomerDetailsDTO";

export class ListCustomers {
  constructor(private customerRepo: CustomerReadRepository) {}

  // async execute(page: number, limit: number): Promise<CustomerDetailsDTO[]> {
  async execute(): Promise<CustomerDetailsDTO[]> {
    // return this.customerRepo.list(page, limit);
    return this.customerRepo.list();
  }
}
