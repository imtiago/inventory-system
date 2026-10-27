import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { ConflictError, ErrorCodes, NotFoundError } from "@shared/domain/errors";
import type { PriceReviewRepository } from "@pricing/application/contracts/PriceReviewRepository";

export const priceReviewNotFound = () =>
  new NotFoundError("Revisão de preço não encontrada.", ErrorCodes.PRICE_REVIEW_NOT_FOUND);

/** "Manter": tira a variante da lista até o próximo gatilho. */
export class DismissPriceReviewUseCase extends TransactionalUseCase<{ id: string; userId: string }, { id: string; status: "DISMISSED" }> {
  constructor(
    private reviews: PriceReviewRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(input: { id: string; userId: string }): Promise<{ id: string; status: "DISMISSED" }> {
    const [review] = await this.reviews.lockByIds([input.id]);
    if (!review) throw priceReviewNotFound();
    if (review.status !== "PENDING") {
      throw new ConflictError("Esta revisão de preço já foi resolvida.", ErrorCodes.PRICE_REVIEW_ALREADY_RESOLVED);
    }
    await this.reviews.resolve([input.id], "DISMISSED", input.userId);
    return { id: input.id, status: "DISMISSED" };
  }
}
