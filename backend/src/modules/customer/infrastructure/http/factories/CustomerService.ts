import { CustomerApplicationService } from "@customer/application/services/CustomerApplicationService";
import { GetCustomerByIdUseCase } from "@customer/application/useCases/queries/GetCustomerByIdUseCase";
import { PrismaCustomerReadRepository } from "@customer/infrastructure/prisma/contracts/PrismaCustomerReadRepository";

export function makeCustomerService() {
  const repository = new PrismaCustomerReadRepository();

  const getCustomer = new GetCustomerByIdUseCase(repository);

  return new CustomerApplicationService(getCustomer);
}
