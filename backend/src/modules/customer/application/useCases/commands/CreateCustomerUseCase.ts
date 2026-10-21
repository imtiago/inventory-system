import { CustomerRepository } from "../../../domain/repositories/CustomerRepository";
import { Customer } from "../../../domain/entities/Customer";
import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { NumberGenerator } from "@shared/application/services/NumberGenerator";
import { NumberRangeName } from "@shared/domain/enums/NumberRangeName";
import { ICreateCustomerInput } from "@customer/application/dto/CustomerDTO";

export class CreateCustomerUseCase extends TransactionalUseCase<
  ICreateCustomerInput,
  Customer
> {
  constructor(
    private customerRepo: CustomerRepository,
    private numberGenerator: NumberGenerator,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: ICreateCustomerInput,
    tx: Prisma.TransactionClient,
  ): Promise<Customer> {
    const customerCode = await this.numberGenerator.generate(
      NumberRangeName.CUSTOMER,
      "C",
    );

    const customer = new Customer({
      code: customerCode,
      ...request,
    });
    return this.customerRepo.create(customer);
  }
}
