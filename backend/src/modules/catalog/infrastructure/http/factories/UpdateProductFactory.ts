import { UpdateProductUseCase } from "@catalog/application/useCases/commands/UpdateProductUseCase";
import { PrismaProductRepository } from "@catalog/infrastructure/prisma/repositories/PrismaProductRepository";
import { PrismaBrandRepository } from "@catalog/infrastructure/prisma/repositories/PrismaBrandRepository";
import { PrismaCategoryRepository } from "@catalog/infrastructure/prisma/repositories/PrismaCategoryRepository";
import { PrismaProductReadRepository } from "@catalog/infrastructure/prisma/contracts/PrismaProductReadRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeUpdateProductUseCase() {
  return new UpdateProductUseCase(
    new PrismaProductRepository(),
    new PrismaBrandRepository(),
    new PrismaCategoryRepository(),
    new PrismaProductReadRepository(),
    new PrismaTransactionManager(),
  );
}
