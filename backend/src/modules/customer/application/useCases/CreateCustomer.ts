// /src/modules/customer/application/useCases/CreateCustomer.ts
import { CustomerRepository } from "../../domain/repositories/CustomerRepository";
import { Customer } from "../../domain/entities/Customer";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
export interface CreateCustomerDTO {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}
export class CreateCustomer extends TransactionalUseCase<
  CreateCustomerDTO,
  Customer
> {
  constructor(
    private customerRepo: CustomerRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: CreateCustomerDTO,
    tx: Prisma.TransactionClient,
  ): Promise<Customer> {
    const customer = new Customer({
      ...request,
    });
    return this.customerRepo.create(customer);
  }
}
