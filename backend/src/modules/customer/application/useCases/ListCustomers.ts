// /src/modules/customer/application/useCases/ListCustomers.ts
import { CustomerRepository } from "../../domain/repositories/CustomerRepository";
import { Customer } from "../../domain/entities/Customer";

export class ListCustomers {
  constructor(private customerRepo: CustomerRepository) {}

  async execute(page: number, limit: number): Promise<Customer[]> {
    return this.customerRepo.list(page, limit);
  }
}
