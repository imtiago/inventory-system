import { readTogether } from "@shared/infrastructure/database/readTogether";
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
import { normalizeDocument } from "@shared/domain/document";
import { containsLiteral } from "@shared/infrastructure/database/literalSearch";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

/** Busca por telefone só a partir de 4 dígitos, para não casar com qualquer coisa. */
const MIN_PHONE_SEARCH_DIGITS = 4;
/** Busca por documento só a partir de 3 caracteres. */
const MIN_DOCUMENT_SEARCH_CHARS = 3;

function buildWhere(search?: string): Prisma.CustomerWhereInput {
  const term = search?.trim();
  if (!term) return {};

  const contains = (field: "name" | "code" | "email") => ({ [field]: containsLiteral(term) });
  const digits = term.replace(/\D/g, "");
  // Termo só com dígitos (e máscara) casa pelos dígitos; com letras e dígitos (CNPJ
  // alfanumérico) casa pelo valor normalizado em maiúsculas.
  const normalized = normalizeDocument(term);
  const documentTerm = /[A-Z]/.test(normalized) && /\d/.test(normalized) ? normalized : digits;

  return {
    OR: [
      contains("name"),
      contains("code"),
      contains("email"),
      ...(documentTerm.length >= MIN_DOCUMENT_SEARCH_CHARS ? [{ document: { contains: documentTerm } }] : []),
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

    const [customers, total] = await readTogether([
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
