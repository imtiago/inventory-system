// /src/modules/customer/application/useCases/CreateCustomer.ts
import { CustomerRepository } from "../../domain/repositories/CustomerRepository";
import { Customer } from "../../domain/entities/Customer";
export interface CreateCustomerDTO {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}
export class CreateCustomer {
  constructor(private customerRepo: CustomerRepository) {}

  async execute(data: CreateCustomerDTO): Promise<Customer> {
    const customer = new Customer({
      ...data,
    });
    return this.customerRepo.create(customer);
  }
}
