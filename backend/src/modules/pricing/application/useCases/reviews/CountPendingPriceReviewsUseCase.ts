import type { PriceReviewRepository } from "@pricing/application/contracts/PriceReviewRepository";
import type { PriceReviewCountDTO } from "@pricing/application/dto/PriceReviewDTO";

export class CountPendingPriceReviewsUseCase {
  constructor(private reviews: PriceReviewRepository) {}

  async execute(): Promise<PriceReviewCountDTO> {
    return { pending: await this.reviews.countPending() };
  }
}
