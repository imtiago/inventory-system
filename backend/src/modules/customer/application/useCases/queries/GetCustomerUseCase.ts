import { CustomerReadRepository } from "@customer/application/contracts/CustomerReadRepository";
import { ICustomerDTO } from "@customer/application/dto/CustomerDTO";

export class GetCustomerUseCase {
  constructor(private customerRepo: CustomerReadRepository) {}

  async execute(id: string): Promise<ICustomerDTO | null> {
    return this.customerRepo.getById(id);
  }
}
