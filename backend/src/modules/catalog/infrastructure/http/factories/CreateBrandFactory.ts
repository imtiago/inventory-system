import { CreateBrandUseCase } from "@catalog/application/useCases/commands/CreateBrandUseCase";
import { PrismaBrandRepository } from "@catalog/infrastructure/prisma/repositories/PrismaBrandRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeCreateBrandUseCase() {
  return new CreateBrandUseCase(new PrismaBrandRepository(), new PrismaTransactionManager());
}
