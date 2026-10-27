import { BusinessRuleError, ErrorCodes } from "@shared/domain/errors";
import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { MAX_FINE_BPS, type CreditRules } from "@credit/domain/creditRules";
import type { CreditSettingsRepository } from "@credit/application/contracts/CreditSettingsRepository";
import type { CreditActivationChecks } from "@credit/application/contracts/CreditActivationChecks";
import { toCreditSettingsDTO, type CreditSettingsDTO } from "@credit/application/dto/CreditSettingsDTO";

export interface UpdateCreditSettingsInput {
  crediarioEnabled?: boolean;
  rules?: CreditRules;
  userId: string | null;
}

/**
 * Altera regras e/ou liga/desliga o crediário (trava a linha das configurações).
 * Multa > 2% → 422 FINE_ABOVE_LEGAL_LIMIT. Ligar exige dados da loja e ao menos um aprovador de crédito
 * (spec §10) e registra quem/quando; desligar limpa o registro de ativação.
 */
export class UpdateCreditSettingsUseCase extends TransactionalUseCase<UpdateCreditSettingsInput, CreditSettingsDTO> {
  constructor(
    private readonly settings: CreditSettingsRepository,
    private readonly checks: CreditActivationChecks,
    transactionManager: TransactionManager,
    private readonly now: () => Date = () => new Date(),
  ) {
    super(transactionManager);
  }

  protected async handle(input: UpdateCreditSettingsInput): Promise<CreditSettingsDTO> {
    if (input.rules && input.rules.fineBps > MAX_FINE_BPS) {
      throw new BusinessRuleError("A multa não pode passar de 2% (CDC, art. 52 §1º).", ErrorCodes.FINE_ABOVE_LEGAL_LIMIT);
    }
    await this.settings.lock();
    const current = await this.settings.read();
    const enabled = input.crediarioEnabled ?? current.crediarioEnabled;

    let enabledAt = current.enabledAt;
    let enabledById = current.enabledBy?.id ?? null;
    if (enabled && !current.crediarioEnabled) {
      if (!(await this.checks.storeDataComplete())) {
        throw new BusinessRuleError("Preencha os dados da loja antes de ativar o crediário.", ErrorCodes.STORE_SETTINGS_MISSING);
      }
      if ((await this.checks.activeApproverCount()) < 1) {
        throw new BusinessRuleError(
          "Marque ao menos um usuário como \"Pode aprovar crédito\" antes de ativar o crediário.",
          ErrorCodes.CREDIT_APPROVER_MISSING,
        );
      }
      enabledAt = this.now();
      enabledById = input.userId;
    } else if (!enabled) {
      enabledAt = null;
      enabledById = null;
    }

    await this.settings.save({
      crediarioEnabled: enabled,
      rules: input.rules ?? current.rules,
      enabledAt,
      enabledById,
      updatedById: input.userId,
    });
    return toCreditSettingsDTO(await this.settings.read());
  }
}
