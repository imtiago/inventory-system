// /src/modules/customer/domain/repositories/CustomerRepository.ts
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
import { Customer } from "../entities/Customer";

export interface CustomerRepository extends ICrudRepository<Customer> {
  // list(page: number, limit: number): Promise<Customer[]>;
}
