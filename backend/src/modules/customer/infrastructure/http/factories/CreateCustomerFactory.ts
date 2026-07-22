import { CreateCustomer } from "@customer/application/useCases/CreateCustomer";
import { PrismaCustomerRepository } from "@customer/infrastructure/prisma/repositories/PrismaCustomerRepository";

export function makeCreateCustomerUseCase() {
  const repository = new PrismaCustomerRepository();
  const useCase = new CreateCustomer(repository);

  return useCase;
}
