// /src/modules/customer/application/useCases/GetCustomer.ts
import { CustomerRepository } from "../../domain/repositories/CustomerRepository";
import { Customer } from "../../domain/entities/Customer";

export class GetCustomer {
  constructor(private customerRepo: CustomerRepository) {}

  async execute(id: string): Promise<Customer | null> {
    return this.customerRepo.getById(id);
  }
}
