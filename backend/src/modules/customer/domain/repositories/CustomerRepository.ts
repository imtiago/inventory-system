// /src/modules/customer/domain/repositories/CustomerRepository.ts
import { Customer } from "../entities/Customer";

export interface CustomerRepository {
  create(customer: Customer): Promise<Customer>;
  list(page: number, limit: number): Promise<Customer[]>;
  findById(id: string): Promise<Customer | null>;
  update(customer: Customer): Promise<Customer>;
}
