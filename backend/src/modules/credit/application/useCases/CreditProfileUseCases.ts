import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import type { CreditProfileCode } from "@credit/domain/CreditProfileCode";
import type { CreditProfileRepository } from "@credit/application/contracts/CreditProfileReader";
import { toCreditProfileDTO, type CreditProfileDTO } from "@credit/application/dto/CreditProfileDTO";

export class ListCreditProfilesUseCase {
  constructor(private readonly profiles: CreditProfileRepository) {}

  async execute(): Promise<CreditProfileDTO[]> {
    return (await this.profiles.list()).map((p, i) => toCreditProfileDTO(p, i));
  }
}

export interface UpdateCreditProfileInput {
  code: CreditProfileCode;
  initialLimitCents: number;
  minDownPaymentBps: number;
  maxInstallments: number;
}

/** Edita os parâmetros do perfil. Não mexe no limite de quem já está no perfil. */
export class UpdateCreditProfileUseCase {
  constructor(
    private readonly profiles: CreditProfileRepository,
    private readonly transactionManager: TransactionManager,
  ) {}

  execute(input: UpdateCreditProfileInput): Promise<CreditProfileDTO> {
    return this.transactionManager.execute(async () => {
      await this.profiles.update(input.code, input);
      const all = await this.profiles.list();
      const index = all.findIndex((p) => p.code === input.code);
      return toCreditProfileDTO(all[index], index);
    });
  }
}
