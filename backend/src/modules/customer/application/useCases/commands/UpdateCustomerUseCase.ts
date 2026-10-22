import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import {
  ICustomerOutput,
  IUpdateCustomerInput,
} from "@customer/application/dto/CustomerDTO";
import { Customer } from "@customer/domain/entities/Customer";
import { CustomerRepository } from "@customer/domain/repositories/CustomerRepository";

export class UpdateCustomerUseCase extends TransactionalUseCase<
  IUpdateCustomerInput,
  ICustomerOutput
> {
  constructor(
    private customerRepo: CustomerRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: IUpdateCustomerInput,
  ): Promise<ICustomerOutput> {
    const customer = new Customer({
      id: request.id,
      address: request.address,
      name: request.name,
      email: request.email,
      phone: request.phone,
    });

    const data = await this.customerRepo.update(customer);

    return {
      id: data.id,
      name: data.name,
      address: data.address,
      email: data.email,
      code: data.code,
      phone: data.phone,
    };
  }
}
