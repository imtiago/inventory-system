import { UpdateBrandUseCase } from "@catalog/application/useCases/commands/UpdateBrandUseCase";
import { PrismaBrandReadRepository } from "@catalog/infrastructure/prisma/contracts/PrismaBrandReadRepository";
import { PrismaBrandRepository } from "@catalog/infrastructure/prisma/repositories/PrismaBrandRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeUpdateBrandUseCase() {
  return new UpdateBrandUseCase(
    new PrismaBrandRepository(),
    new PrismaBrandReadRepository(),
    new PrismaTransactionManager(),
  );
}
