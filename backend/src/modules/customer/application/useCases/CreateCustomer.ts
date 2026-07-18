// /src/modules/customer/application/useCases/CreateCustomer.ts
import { CustomerRepository } from "../../domain/repositories/CustomerRepository";
import { Customer } from "../../domain/entities/Customer";

export class CreateCustomer {
  constructor(private customerRepo: CustomerRepository) {}

  async execute(data: Omit<Customer, "id" | "createdAt">): Promise<Customer> {
    const customer = new Customer({
      ...data,
    });
    return this.customerRepo.create(customer);
  }
}
