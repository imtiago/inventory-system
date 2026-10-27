import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import type { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import type { PriceReviewStatus } from "@pricing/domain/priceReview";
import type { PriceReviewRepository } from "@pricing/application/contracts/PriceReviewRepository";
import { toPriceReviewDTO, type PriceReviewDTO } from "@pricing/application/dto/PriceReviewDTO";

export interface ListPriceReviewsInput {
  status: PriceReviewStatus;
  page: number;
  limit: number;
}

export class ListPriceReviewsUseCase extends TransactionalUseCase<ListPriceReviewsInput, PaginatedResult<PriceReviewDTO>> {
  constructor(
    private reviews: PriceReviewRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(input: ListPriceReviewsInput): Promise<PaginatedResult<PriceReviewDTO>> {
    const { items, total } = await this.reviews.list(input);
    return {
      data: items.map(toPriceReviewDTO),
      pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) },
    };
  }
}
