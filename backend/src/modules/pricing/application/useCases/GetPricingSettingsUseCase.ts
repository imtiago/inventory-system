import type { PricingSettingsReader } from "@pricing/application/contracts/PricingSettingsReader";
import type { PricingSettingsRepository } from "@pricing/application/contracts/PricingSettingsRepository";
import { toSettingsDTO, type PricingSettingsDTO } from "@pricing/application/dto/PricingSettingsDTO";
import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";

export class GetPricingSettingsUseCase extends TransactionalUseCase<void, PricingSettingsDTO> {
  constructor(
    private reader: PricingSettingsReader,
    private repository: PricingSettingsRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  protected async handle(): Promise<PricingSettingsDTO> {
    // Mesma transação: leitura consistente entre a soma e a lista de despesas.
    const snapshot = await this.reader.get();
    return toSettingsDTO(snapshot, await this.repository.listExpenses());
  }
}
