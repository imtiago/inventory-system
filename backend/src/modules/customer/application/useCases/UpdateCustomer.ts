// /src/modules/customer/application/useCases/UpdateCustomer.ts
import { CustomerRepository } from "../../domain/repositories/CustomerRepository";
import { Customer } from "../../domain/entities/Customer";

export class UpdateCustomer {
  constructor(private customerRepo: CustomerRepository) {}

  async execute(customer: Customer): Promise<Customer> {
    return this.customerRepo.update(customer);
  }
}
