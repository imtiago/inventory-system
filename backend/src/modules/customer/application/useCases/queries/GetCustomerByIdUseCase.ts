import { CustomerReadRepository } from "@customer/application/contracts/CustomerReadRepository";
import { ICustomerOutput } from "@customer/application/dto/CustomerDTO";

export class GetCustomerByIdUseCase {
  constructor(private customerRepo: CustomerReadRepository) {}

  async execute(id: string): Promise<ICustomerOutput | null> {
    const data = await this.customerRepo.getById(id);
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      address: data.address,
      code: data.code,
      email: data.email,
      phone: data.phone,
    };
  }
}
