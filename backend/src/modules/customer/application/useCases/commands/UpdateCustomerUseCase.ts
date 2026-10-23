import { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { NotFoundError } from "@shared/domain/errors";
import { CustomerDTO, IUpdateCustomerInput } from "@customer/application/dto/CustomerDTO";
import { CustomerReadMapper } from "@customer/application/mappers/CustomerReadMapper";
import { CustomerRepository } from "@customer/domain/repositories/CustomerRepository";

export class UpdateCustomerUseCase extends TransactionalUseCase<IUpdateCustomerInput, CustomerDTO> {
  constructor(
    private customerRepo: CustomerRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle({ id, ...patch }: IUpdateCustomerInput): Promise<CustomerDTO> {
    const existing = await this.customerRepo.findById(id);
    if (!existing) {
      throw new NotFoundError("Cliente não encontrado.", "CUSTOMER_NOT_FOUND");
    }

    const updated = await this.customerRepo.update(id, patch);
    return CustomerReadMapper.toDTO(updated);
  }
}
