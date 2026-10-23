import { Prisma } from "@prisma/client";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import {
  SupplierListFilters,
  SupplierReadRepository,
} from "@purchases/application/contracts/SupplierReadRepository";
import { SupplierDTO } from "@purchases/application/dto/SupplierDTO";
import { SupplierReadMapper } from "@purchases/application/mappers/SupplierReadMapper";

/** Busca por documento só a partir de 3 dígitos, para não casar com qualquer coisa. */
const MIN_DOCUMENT_SEARCH_DIGITS = 3;

function buildWhere(search?: string): Prisma.SupplierWhereInput {
  const term = search?.trim();
  if (!term) return {};

  // O `contains` do Prisma não escapa os curingas do LIKE: escapamos \, % e _
  // para a busca ser literal (o escape padrão do LIKE no Postgres é a barra invertida).
  const literal = term.replace(/[\\%_]/g, "\\$&");
  const contains = (field: "name" | "email") => ({
    [field]: { contains: literal, mode: "insensitive" as const },
  });
  const digits = term.replace(/\D/g, "");

  return {
    OR: [
      contains("name"),
      contains("email"),
      ...(digits.length >= MIN_DOCUMENT_SEARCH_DIGITS ? [{ document: { contains: digits } }] : []),
    ],
  };
}

export class PrismaSupplierReadRepository implements SupplierReadRepository {
  async list(
    pagination: PaginationRequest,
    filters?: SupplierListFilters,
  ): Promise<PaginatedResult<SupplierDTO>> {
    const where = buildWhere(filters?.search);

    const [rows, total] = await Promise.all([
      getDb().supplier.findMany({
        where,
        ...buildPagination(pagination),
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      getDb().supplier.count({ where }),
    ]);

    return buildPaginatedResult(rows.map(SupplierReadMapper.toDTO), total, pagination);
  }

  async getById(id: string): Promise<SupplierDTO | null> {
    const row = await getDb().supplier.findUnique({ where: { id } });
    return row ? SupplierReadMapper.toDTO(row) : null;
  }
}
