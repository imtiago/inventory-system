import { CreateBrandUseCase } from "@catalog/application/useCases/CreateBrandUseCase";
import { PrismaBrandRepository } from "@catalog/infrastructure/prisma/repositories/PrismaBrandRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeCreateBrandUseCase() {
  const repository = new PrismaBrandRepository();
  const transactionManager = new PrismaTransactionManager();

  return new CreateBrandUseCase(repository, transactionManager);
}
