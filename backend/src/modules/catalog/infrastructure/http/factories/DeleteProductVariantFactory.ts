import { DeleteProductVariantUseCase } from "@catalog/application/useCases/commands/DeleteProductVariantUseCase";
import { PrismaProductRepository } from "@catalog/infrastructure/prisma/repositories/PrismaProductRepository";
import { PrismaProductVariantRepository } from "@catalog/infrastructure/prisma/repositories/PrismaProductVariantRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeDeleteProductVariantUseCase() {
  return new DeleteProductVariantUseCase(
    new PrismaProductVariantRepository(),
    new PrismaProductRepository(),
    new PrismaTransactionManager(),
  );
}
