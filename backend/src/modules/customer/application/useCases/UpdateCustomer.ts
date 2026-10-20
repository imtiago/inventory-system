// /src/modules/customer/application/useCases/UpdateCustomer.ts
import { CustomerRepository } from "../../domain/repositories/CustomerRepository";
import { Customer } from "../../domain/entities/Customer";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";

export class UpdateCustomer extends TransactionalUseCase<Customer, Customer> {
  constructor(
    private customerRepo: CustomerRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: Customer,
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
