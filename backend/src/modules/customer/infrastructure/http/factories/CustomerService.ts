import { CustomerApplicationService } from "@customer/application/services/CustomerApplicationService";
import { GetCustomer } from "@customer/application/useCases/queries/GetCustomerUseCase";
import { PrismaCustomerReadRepository } from "@customer/infrastructure/prisma/contracts/PrismaCustomerReadRepository";

export function makeCustomerService() {
  const repository = new PrismaCustomerReadRepository();

  const getCustomer = new GetCustomer(repository);

  return new CustomerApplicationService(getCustomer);
}
