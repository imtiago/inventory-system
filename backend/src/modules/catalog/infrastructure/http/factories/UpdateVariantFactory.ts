import { UpdateVariantUseCase } from "@catalog/application/useCases/commands/UpdateVariantUseCase";
import { PrismaProductVariantRepository } from "@catalog/infrastructure/prisma/repositories/PrismaProductVariantRepository";
import { NoopPriceReviewTrigger } from "@pricing/application/contracts/PriceReviewTrigger";
import { PrismaTransactionManager } from "@shared/infrastructure/prisma/PrismaTransactionManager";

export function makeUpdateVariantUseCase() {
  return new UpdateVariantUseCase(
    new PrismaProductVariantRepository(),
    // A Task 5 troca o no-op pela revisão real de preços.
    new NoopPriceReviewTrigger(),
    new PrismaTransactionManager(),
  );
}
