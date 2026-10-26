import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

/** Escopo da chave: usuário + método + padrão da rota + chave. */
export interface IdempotencyScope {
  userId: string;
  method: string;
  route: string;
  key: string;
}

export interface StoredIdempotencyRecord {
  id: string;
  requestHash: string;
  statusCode: number | null;
  responseBody: unknown;
  responseHeaders: Record<string, string> | null;
}

/** Retenção padrão dos registros (spec: 24 h). */
export const IDEMPOTENCY_RETENTION_HOURS = 24;

/**
 * Registros de idempotência. Todas as operações usam o client da transação
 * ativa (`getDb()`): o registro nasce e recebe a resposta na mesma transação
 * da operação, e some junto se ela for desfeita.
 */
export class PrismaIdempotencyStore {
  /**
   * Tenta registrar a chave. Devolve o id do registro novo, ou null se o escopo
   * já existe. Com uma transação concorrente no mesmo escopo ainda aberta, o
   * INSERT espera por ela no índice único (commit → null; rollback → insere).
   */
  async claim(scope: IdempotencyScope, requestHash: string): Promise<string | null> {
    const rows = await getDb().$queryRaw<{ id: string }[]>`
      INSERT INTO "IdempotencyRecord" ("id", "userId", "method", "route", "key", "requestHash", "createdAt")
      VALUES (${randomUUID()}, ${scope.userId}, ${scope.method}, ${scope.route}, ${scope.key}, ${requestHash},
              now() AT TIME ZONE 'UTC')
      ON CONFLICT ("userId", "method", "route", "key") DO NOTHING
      RETURNING "id"`;
    return rows[0]?.id ?? null;
  }

  /** Lê o registro do escopo travando a linha (FOR UPDATE) até o fim da transação. */
  async lockExisting(scope: IdempotencyScope): Promise<StoredIdempotencyRecord | null> {
    const rows = await getDb().$queryRaw<StoredIdempotencyRecord[]>`
      SELECT "id", "requestHash", "statusCode", "responseBody", "responseHeaders"
      FROM "IdempotencyRecord"
      WHERE "userId" = ${scope.userId} AND "method" = ${scope.method}
        AND "route" = ${scope.route} AND "key" = ${scope.key}
      FOR UPDATE`;
    return rows[0] ?? null;
  }

  async saveResponse(
    id: string,
    statusCode: number,
    responseBody: unknown,
    responseHeaders: Record<string, string> = {},
  ): Promise<void> {
    await getDb().idempotencyRecord.update({
      where: { id },
      data: {
        statusCode,
        responseBody:
          responseBody === undefined || responseBody === null
            ? Prisma.DbNull
            : (responseBody as Prisma.InputJsonValue),
        responseHeaders: Object.keys(responseHeaders).length === 0 ? Prisma.DbNull : responseHeaders,
      },
    });
  }

  /**
   * Remove até `limit` registros mais antigos que a retenção. SKIP LOCKED: não
   * espera por registros travados por outra transação (ex.: um replay em curso).
   * Devolve quantos removeu.
   */
  async purgeExpired(
    limit: number,
    retentionHours: number = IDEMPOTENCY_RETENTION_HOURS,
  ): Promise<number> {
    return getDb().$executeRaw`
      DELETE FROM "IdempotencyRecord"
      WHERE "id" IN (
        SELECT "id" FROM "IdempotencyRecord"
        WHERE "createdAt" < (now() AT TIME ZONE 'UTC') - make_interval(hours => ${retentionHours}::int)
        ORDER BY "createdAt"
        LIMIT ${limit}::int
        FOR UPDATE SKIP LOCKED
      )`;
  }
}
