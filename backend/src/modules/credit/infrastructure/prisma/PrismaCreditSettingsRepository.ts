import type { Prisma } from "@prisma/client";
import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { getDb, hasActiveTransaction } from "@shared/infrastructure/prisma/transactionContext";
import type { CreditRules } from "@credit/domain/creditRules";
import { creditRulesSchema } from "@credit/interfaces/http/schemas/creditSchemas";
import type {
  CreditSettingsRecord,
  CreditSettingsStore,
  CreditSettingsWrite,
} from "@credit/application/contracts/CreditSettingsRepository";

const SETTINGS_ID = "default";
const person = { select: { id: true, name: true } } as const;

function parseRules(json: unknown): CreditRules {
  const parsed = creditRulesSchema.safeParse(json);
  if (!parsed.success) {
    throw new InternalInvariantError(
      `CreditSettings.rules inválido: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      InternalErrorCodes.CREDIT_SETTINGS_INVALID,
    );
  }
  return parsed.data;
}

/** Linha única `CreditSettings` (criada pela migration; ausente = banco inconsistente). */
export class PrismaCreditSettingsRepository implements CreditSettingsStore {
  async lock(): Promise<void> {
    if (!hasActiveTransaction()) {
      throw new InternalInvariantError("Trava das configurações de crédito exige transação ativa.", InternalErrorCodes.LOCK_OUTSIDE_TRANSACTION);
    }
    await getDb().$queryRaw`SELECT id FROM "CreditSettings" WHERE id = ${SETTINGS_ID} FOR UPDATE`;
  }

  async read(): Promise<CreditSettingsRecord> {
    const row = await getDb().creditSettings.findUnique({
      where: { id: SETTINGS_ID },
      include: { enabledBy: person, updatedBy: person },
    });
    if (!row) {
      throw new InternalInvariantError("Configurações de crédito ausentes.", InternalErrorCodes.CREDIT_SETTINGS_INVALID);
    }
    return {
      crediarioEnabled: row.crediarioEnabled,
      rules: parseRules(row.rules),
      enabledAt: row.enabledAt,
      enabledBy: row.enabledBy,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    };
  }

  async get(): Promise<{ crediarioEnabled: boolean; rules: CreditRules }> {
    const { crediarioEnabled, rules } = await this.read();
    return { crediarioEnabled, rules };
  }

  async save(input: CreditSettingsWrite): Promise<void> {
    await getDb().creditSettings.update({
      where: { id: SETTINGS_ID },
      data: {
        crediarioEnabled: input.crediarioEnabled,
        rules: parseRules(input.rules) as unknown as Prisma.InputJsonValue,
        enabledAt: input.enabledAt,
        enabledById: input.enabledById,
        updatedById: input.updatedById,
        updatedAt: new Date(),
      },
    });
  }
}
