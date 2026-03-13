// /src/modules/customer/application/useCases/CreateCustomer.ts
import { CustomerRepository } from "../../domain/repositories/CustomerRepository";
import { Customer } from "../../domain/entities/Customer";
import { v4 as uuidv4 } from "uuid";

export class CreateCustomer {
  constructor(private customerRepo: CustomerRepository) {}

  async execute(data: Omit<Customer, "id" | "createdAt">): Promise<Customer> {
    const customer: Customer = {
      id: uuidv4(),
      createdAt: new Date(),
      ...data,
    };
    return this.customerRepo.create(customer);
  }
}
