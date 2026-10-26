import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { NumberGenerator } from "@shared/application/services/NumberGenerator";
import { NumberRangeName } from "@shared/domain/enums/NumberRangeName";
import {
  ICreateCustomerInput,
  CustomerDTO,
} from "@customer/application/dto/CustomerDTO";
import { CustomerReadMapper } from "@customer/application/mappers/CustomerReadMapper";
import { customerDocumentExists } from "@customer/domain/errors";
import { Customer } from "@customer/domain/entities/Customer";
import { CustomerRepository } from "@customer/domain/repositories/CustomerRepository";

export class CreateCustomerUseCase extends TransactionalUseCase<
  ICreateCustomerInput,
  CustomerDTO
> {
  constructor(
    private customerRepo: CustomerRepository,
    private numberGenerator: NumberGenerator,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(
    request: ICreateCustomerInput,
  ): Promise<CustomerDTO> {
    if (request.document && (await this.customerRepo.findByDocument(request.document))) {
      throw customerDocumentExists();
    }

    const customerCode = await this.numberGenerator.generate(
      NumberRangeName.CUSTOMER,
      "C",
    );

    const customer = new Customer({
      code: customerCode,
      ...request,
    });

    const data = await this.customerRepo.create(customer);

    return CustomerReadMapper.toDTO(data);
  }
}
