import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import type {
  StoreSettingsData,
  StoreSettingsRecord,
  StoreSettingsRepository,
} from "@credit/application/contracts/StoreSettingsRepository";

const STORE_ID = "default";

export class PrismaStoreSettingsRepository implements StoreSettingsRepository {
  async find(): Promise<StoreSettingsRecord | null> {
    const row = await getDb().storeSettings.findUnique({ where: { id: STORE_ID } });
    return row ? { name: row.name, cnpj: row.cnpj, address: row.address, phone: row.phone, updatedAt: row.updatedAt } : null;
  }

  /** Upsert atômico (dois ADMIN salvando juntos não dão P2002): a última gravação vence. */
  async save(data: StoreSettingsData): Promise<StoreSettingsRecord> {
    await getDb().$executeRaw`
      INSERT INTO "StoreSettings" ("id", "name", "cnpj", "address", "phone", "updatedAt")
      VALUES (${STORE_ID}, ${data.name}, ${data.cnpj}, ${data.address}, ${data.phone}, now())
      ON CONFLICT ("id") DO UPDATE SET
        "name" = EXCLUDED."name", "cnpj" = EXCLUDED."cnpj", "address" = EXCLUDED."address",
        "phone" = EXCLUDED."phone", "updatedAt" = EXCLUDED."updatedAt"`;
    const saved = await this.find();
    return saved!;
  }
}
