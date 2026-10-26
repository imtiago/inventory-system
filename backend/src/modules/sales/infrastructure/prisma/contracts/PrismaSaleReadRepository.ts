import { readTogether } from "@shared/infrastructure/database/readTogether";
import { Prisma } from "@prisma/client";
import { SaleListFilter, SaleReadRepository } from "@sales/application/contracts/SaleReadRepository";
import { SaleDetailDTO, SaleListItemDTO } from "@sales/application/dto/SaleDTO";
import { SaleReadMapper } from "@sales/application/mappers/SaleReadMapper";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

const personSelect = { select: { id: true, name: true } } as const;

const TZ = "America/Sao_Paulo";

/**
 * Limites UTC [início, fim) dos dias de negócio from..to, calculados no banco com a
 * mesma expressão do relatório CSV de vendas (mesma semântica de período).
 */
async function periodBounds(from: string, to: string): Promise<{ gte: Date; lt: Date }> {
  const [row] = await getDb().$queryRaw<{ lo: Date; hi: Date }[]>`
    SELECT ((${from}::date)::timestamp AT TIME ZONE ${TZ}) AT TIME ZONE 'UTC' AS "lo",
           (((${to}::date + 1))::timestamp AT TIME ZONE ${TZ}) AT TIME ZONE 'UTC' AS "hi"`;
  return { gte: row.lo, lt: row.hi };
}

export class PrismaSaleReadRepository implements SaleReadRepository {
  async list(pagination: PaginationRequest, filter: SaleListFilter = {}): Promise<PaginatedResult<SaleListItemDTO>> {
    const paginationOptions = buildPagination(pagination);
    const where: Prisma.SaleWhereInput = {};
    if (filter.from && filter.to) where.createdAt = await periodBounds(filter.from, filter.to);
    if (filter.status) where.status = filter.status;
    const [sales, total] = await readTogether([
      getDb().sale.findMany({
        ...paginationOptions,
        where,
        include: {
          customer: personSelect,
          _count: { select: { items: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
      getDb().sale.count({ where }),
    ]);

    return buildPaginatedResult(sales.map(SaleReadMapper.toListItemDTO), total, pagination);
  }

  async getById(id: string): Promise<SaleDetailDTO | null> {
    const sale = await getDb().sale.findUnique({
      where: { id },
      include: {
        customer: personSelect,
        seller: personSelect,
        items: {
          include: { productVariant: { select: { code: true } } },
          orderBy: { id: "asc" },
        },
      },
    });

    if (!sale) {
      return null;
    }

    // Documento de contas a receber gerado pela venda (origem SALE, originId = venda).
    const receivable = await getDb().financialDocument.findFirst({
      where: { type: "RECEIVABLE", originType: "SALE", originId: id },
      select: {
        id: true,
        status: true,
        parcels: {
          select: {
            id: true,
            amount: true,
            dueDate: true,
            payments: { select: { amount: true, reversedAt: true } },
          },
          orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return SaleReadMapper.toDetailDTO(sale, receivable);
  }
}
