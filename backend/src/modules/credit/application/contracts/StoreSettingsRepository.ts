export interface StoreSettingsData {
  name: string;
  cnpj: string;
  address: string;
  phone: string;
}

export interface StoreSettingsRecord extends StoreSettingsData {
  updatedAt: Date;
}

/** Dados da loja (linha única `default`); ausente até o ADMIN preencher. */
export interface StoreSettingsRepository {
  find(): Promise<StoreSettingsRecord | null>;
  save(data: StoreSettingsData): Promise<StoreSettingsRecord>;
}
