import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { ErrorCodes, NotFoundError } from "@shared/domain/errors";
import type { VariantPricingWriter } from "@pricing/application/contracts/VariantPricingRepository";
import type { VariantPricingDTO } from "@pricing/application/dto/VariantPricingDTO";
import type { GetVariantPricingUseCase } from "@pricing/application/useCases/queries/GetVariantPricingUseCase";

export class SetSupplierSuggestedPriceUseCase extends TransactionalUseCase<
  { variantId: string; priceCents: number | null },
  VariantPricingDTO
> {
  constructor(
    private writer: VariantPricingWriter,
    private get: GetVariantPricingUseCase,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(input: { variantId: string; priceCents: number | null }): Promise<VariantPricingDTO> {
    if (!(await this.writer.lockVariant(input.variantId))) {
      throw new NotFoundError("Variante não encontrada.", ErrorCodes.VARIANT_NOT_FOUND);
    }
    await this.writer.setSupplierPrice(input.variantId, input.priceCents);
    return this.get.execute({ variantId: input.variantId });
  }
}
