import { DeleteProductUseCase } from "@catalog/application/useCases/commands/DeleteProductUseCase";
import { PrismaProductRepository } from "@catalog/infrastructure/prisma/repositories/PrismaProductRepository";
import { PrismaProductVariantRepository } from "@catalog/infrastructure/prisma/repositories/PrismaProductVariantRepository";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeDeleteProductUseCase() {
  return new DeleteProductUseCase(
    new PrismaProductRepository(),
    new PrismaProductVariantRepository(),
    new PrismaTransactionManager(),
  );
}
