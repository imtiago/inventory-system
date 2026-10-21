import { CustomerRepository } from "../../../domain/repositories/CustomerRepository";
import { Customer } from "../../../domain/entities/Customer";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { IUpdateCustomerInput } from "@customer/application/dto/CustomerDTO";

export class UpdateCustomerUseCase extends TransactionalUseCase<
  IUpdateCustomerInput,
  Customer
> {
  constructor(
    private customerRepo: CustomerRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: IUpdateCustomerInput,
    tx: Prisma.TransactionClient,
  ): Promise<Customer> {
    const customer = new Customer({
      id: request.id,
      address: request.address,
      name: request.name,
      email: request.email,
      phone: request.phone,
    });
    return await this.customerRepo.update(customer);
  }
}
