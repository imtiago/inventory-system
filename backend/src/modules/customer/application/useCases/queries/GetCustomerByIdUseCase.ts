import { CustomerReadRepository } from "@customer/application/contracts/CustomerReadRepository";
import { CustomerDTO } from "@customer/application/dto/CustomerDTO";

export class GetCustomerByIdUseCase {
  constructor(private customerRepo: CustomerReadRepository) {}

  async execute(id: string): Promise<CustomerDTO | null> {
    return this.customerRepo.getById(id);
  }
}
