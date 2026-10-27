import type { CreditSettingsRepository } from "@credit/application/contracts/CreditSettingsRepository";
import { toCreditSettingsDTO, type CreditSettingsDTO } from "@credit/application/dto/CreditSettingsDTO";

export class GetCreditSettingsUseCase {
  constructor(private readonly settings: CreditSettingsRepository) {}

  async execute(): Promise<CreditSettingsDTO> {
    return toCreditSettingsDTO(await this.settings.read());
  }
}
