// /src/modules/customer/application/useCases/GetCustomer.ts
import { CustomerReadRepository } from "../contracts/CustomerReadRepository";
import { CustomerDetailsDTO } from "../dto/CustomerDetailsDTO";

export class GetCustomer {
  constructor(private customerRepo: CustomerReadRepository) {}

  async execute(id: string): Promise<CustomerDetailsDTO | null> {
    return this.customerRepo.getById(id);
  }
}
