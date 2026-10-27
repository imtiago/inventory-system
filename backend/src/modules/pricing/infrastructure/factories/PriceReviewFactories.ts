import { PriceReviewService } from "@pricing/application/services/PriceReviewService";
import { PrismaPriceReviewRepository } from "@pricing/infrastructure/prisma/PrismaPriceReviewRepository";
import { PrismaPricingSettingsReader } from "@pricing/infrastructure/prisma/PrismaPricingSettingsReader";
import { PrismaPricingSettingsRepository } from "@pricing/infrastructure/prisma/PrismaPricingSettingsRepository";

/** Gatilho real da revisão de preços (estoque, configuração, preço). */
export function makePriceReviewService(): PriceReviewService {
  return new PriceReviewService(
    new PrismaPriceReviewRepository(),
    new PrismaPricingSettingsReader(),
    new PrismaPricingSettingsRepository(),
  );
}
