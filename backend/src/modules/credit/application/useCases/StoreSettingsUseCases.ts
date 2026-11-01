import type { TransactionManager } from "@shared/application/transaction/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import type { StoreSettingsData, StoreSettingsRepository } from "@credit/application/contracts/StoreSettingsRepository";

export interface StoreSettingsDTO extends StoreSettingsData {
  /** Nome, CNPJ, endereço e telefone preenchidos (pré-requisito do carnê e da ativação do crediário). */
  configured: boolean;
  updatedAt: string | null;
}

function toDTO(record: (StoreSettingsData & { updatedAt: Date }) | null): StoreSettingsDTO {
  if (!record) return { name: "", cnpj: "", address: "", phone: "", configured: false, updatedAt: null };
  return {
    name: record.name,
    cnpj: record.cnpj,
    address: record.address,
    phone: record.phone,
    configured: true,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class GetStoreSettingsUseCase {
  constructor(private readonly store: StoreSettingsRepository) {}
  async execute(): Promise<StoreSettingsDTO> {
    return toDTO(await this.store.find());
  }
}

export class UpdateStoreSettingsUseCase extends TransactionalUseCase<StoreSettingsData, StoreSettingsDTO> {
  constructor(
    private readonly store: StoreSettingsRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }
  protected async handle(input: StoreSettingsData): Promise<StoreSettingsDTO> {
    return toDTO(await this.store.save(input));
  }
}
