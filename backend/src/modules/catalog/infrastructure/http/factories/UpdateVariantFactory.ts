import { UpdateVariantUseCase } from "@catalog/application/useCases/commands/UpdateVariantUseCase";
import { PrismaProductVariantRepository } from "@catalog/infrastructure/prisma/repositories/PrismaProductVariantRepository";
import { makePriceReviewService } from "@pricing/infrastructure/factories/PriceReviewFactories";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeUpdateVariantUseCase() {
  return new UpdateVariantUseCase(
    new PrismaProductVariantRepository(),
    makePriceReviewService(),
    new PrismaTransactionManager(),
  );
}
