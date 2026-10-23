import { Prisma } from "@prisma/client";
import {
  CustomerListFilters,
  CustomerReadRepository,
} from "@customer/application/contracts/CustomerReadRepository";
import { CustomerDTO } from "@customer/application/dto/CustomerDTO";
import { CustomerReadMapper } from "@customer/application/mappers/CustomerReadMapper";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

/** Busca por telefone só a partir de 4 dígitos, para não casar com qualquer coisa. */
const MIN_PHONE_SEARCH_DIGITS = 4;

function buildWhere(search?: string): Prisma.CustomerWhereInput {
  const term = search?.trim();
  if (!term) return {};

  // O `contains` do Prisma não escapa os curingas do LIKE: escapamos \, % e _
  // para a busca ser literal (o escape padrão do LIKE no Postgres é a barra invertida).
  const literal = term.replace(/[\\%_]/g, "\\$&");
  const contains = (field: "name" | "code" | "email") => ({
    [field]: { contains: literal, mode: "insensitive" as const },
  });
  const digits = term.replace(/\D/g, "");

  return {
    OR: [
      contains("name"),
      contains("code"),
      contains("email"),
      ...(digits.length >= MIN_PHONE_SEARCH_DIGITS ? [{ phone: { contains: digits } }] : []),
    ],
  };
}

export class PrismaCustomerReadRepository implements CustomerReadRepository {
  async list(
    pagination: PaginationRequest,
    filters?: CustomerListFilters,
  ): Promise<PaginatedResult<CustomerDTO>> {
    const where = buildWhere(filters?.search);

    const [customers, total] = await Promise.all([
      getDb().customer.findMany({
        where,
        ...buildPagination(pagination),
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      getDb().customer.count({ where }),
    ]);

    return buildPaginatedResult(customers.map(CustomerReadMapper.toDTO), total, pagination);
  }

  async getById(id: string): Promise<CustomerDTO | null> {
    const customer = await getDb().customer.findUnique({ where: { id } });
    return customer ? CustomerReadMapper.toDTO(customer) : null;
  }
}
