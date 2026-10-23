import { Prisma } from "@prisma/client";
import { InternalErrorCodes, InternalInvariantError } from "@shared/domain/errors";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { getDb, hasActiveTransaction } from "@shared/infrastructure/prisma/transactionContext";

/**
 * SQL comum a marcas e categorias (mesmo formato: id, name, createdAt; Product
 * aponta via brandId/categoryId). Os identificadores vêm desta tabela fixa,
 * nunca da entrada.
 */
const TABLES = {
  brand: { table: Prisma.raw(`"Brand"`), fk: Prisma.raw(`"brandId"`) },
  category: { table: Prisma.raw(`"Category"`), fk: Prisma.raw(`"categoryId"`) },
} as const;

export type NamedCatalogTable = keyof typeof TABLES;

export type NamedRow = { id: string; name: string; productsCount: number };

export function assertInTransaction(what: string): void {
  if (!hasActiveTransaction()) {
    throw new InternalInvariantError(
      `Trava de ${what} exige transação ativa.`,
      InternalErrorCodes.LOCK_OUTSIDE_TRANSACTION,
    );
  }
}

/** P2002 do índice único de expressão lower(name) ("Brand_name_lower_key"/"Category_name_lower_key"). */
export function isUniqueNameViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = (error.meta as { target?: unknown } | undefined)?.target;
  const parts = Array.isArray(target) ? target.map(String) : [String(target ?? "")];
  return parts.some((t) => t.includes("lower(name)") || t.endsWith("_name_lower_key"));
}

/** Id da linha com o mesmo nome sem diferença de caixa (usa o índice lower(name)). */
export async function findIdByName(kind: NamedCatalogTable, name: string): Promise<string | null> {
  const { table } = TABLES[kind];
  const rows = await getDb().$queryRaw<{ id: string }[]>`
    SELECT id FROM ${table} WHERE lower(name) = lower(${name}) LIMIT 1`;
  return rows[0]?.id ?? null;
}

export async function lockRow(kind: NamedCatalogTable, id: string): Promise<boolean> {
  const { table } = TABLES[kind];
  const rows = await getDb().$queryRaw<{ id: string }[]>`
    SELECT id FROM ${table} WHERE id = ${id} FOR UPDATE`;
  return rows.length > 0;
}

/** Lista paginada com productsCount, ordenada por lower(name), id; search = contém, sem caixa, literal. */
export async function listWithProductsCount(
  kind: NamedCatalogTable,
  pagination: PaginationRequest,
  search?: string,
): Promise<PaginatedResult<NamedRow>> {
  const { table, fk } = TABLES[kind];
  const term = search?.trim();
  // strpos em vez de LIKE: % e _ na busca são literais, sem escape.
  const where = term ? Prisma.sql`WHERE strpos(lower(t.name), lower(${term})) > 0` : Prisma.empty;
  const { skip, take } = buildPagination(pagination);

  const [rows, totals] = await Promise.all([
    getDb().$queryRaw<NamedRow[]>`
      SELECT t.id, t.name,
             (SELECT count(*) FROM "Product" p WHERE p.${fk} = t.id)::int AS "productsCount"
      FROM ${table} t
      ${where}
      ORDER BY lower(t.name), t.id
      LIMIT ${take} OFFSET ${skip}`,
    getDb().$queryRaw<{ total: number }[]>`
      SELECT count(*)::int AS total FROM ${table} t ${where}`,
  ]);

  return buildPaginatedResult(rows, totals[0]?.total ?? 0, pagination);
}
