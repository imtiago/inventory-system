import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { BusinessRuleError, ErrorCodes, NotFoundError } from "@shared/domain/errors";
import { toCents } from "@shared/domain/money";
import type { PriceReviewTrigger } from "@pricing/application/contracts/PriceReviewTrigger";
import type { VariantPricingWriter } from "@pricing/application/contracts/VariantPricingRepository";
import type { VariantPricingDTO } from "@pricing/application/dto/VariantPricingDTO";
import type { GetVariantPricingUseCase } from "@pricing/application/useCases/queries/GetVariantPricingUseCase";

export type ApplyPriceSource = "SUGGESTED" | "SUPPLIER";

export class ApplyVariantPriceUseCase extends TransactionalUseCase<
  { variantId: string; source: ApplyPriceSource; userId: string },
  VariantPricingDTO
> {
  constructor(
    private writer: VariantPricingWriter,
    private get: GetVariantPricingUseCase,
    private trigger: PriceReviewTrigger,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(input: { variantId: string; source: ApplyPriceSource; userId: string }): Promise<VariantPricingDTO> {
    if (!(await this.writer.lockVariant(input.variantId))) {
      throw new NotFoundError("Variante não encontrada.", ErrorCodes.VARIANT_NOT_FOUND);
    }
    const current = await this.get.execute({ variantId: input.variantId });
    const price = input.source === "SUGGESTED" ? current.suggestedPrice : current.supplierSuggestedPrice;
    if (price === null) {
      throw input.source === "SUGGESTED"
        ? new BusinessRuleError(
            "Não há preço sugerido: configure os preços e confira se a variante tem custo.",
            ErrorCodes.SUGGESTED_PRICE_UNAVAILABLE,
          )
        : new BusinessRuleError("A variante não tem preço da revista.", ErrorCodes.SUPPLIER_PRICE_UNAVAILABLE);
    }
    if (toCents(price) !== toCents(current.salePrice)) {
      await this.writer.setSalePrice(input.variantId, toCents(price));
      await this.trigger.priceApplied(input.variantId, input.userId);
    }
    return this.get.execute({ variantId: input.variantId });
  }
}
