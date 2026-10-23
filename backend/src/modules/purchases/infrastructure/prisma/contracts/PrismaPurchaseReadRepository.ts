import { Prisma } from "@prisma/client";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { fromDateOnly } from "@finance/domain/services/receivableStatus";
import {
  PurchaseListFilters,
  PurchaseReadRepository,
} from "@purchases/application/contracts/PurchaseReadRepository";
import { PurchaseDTO, PurchaseListItemDTO } from "@purchases/application/dto/PurchaseDTO";
import { PurchaseReadMapper } from "@purchases/application/mappers/PurchaseReadMapper";

const supplierSelect = { select: { id: true, name: true } } as const;

function buildWhere(filters: PurchaseListFilters = {}): Prisma.PurchaseWhereInput {
  const where: Prisma.PurchaseWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.from || filters.to) {
    where.purchaseDate = {
      ...(filters.from ? { gte: fromDateOnly(filters.from) } : {}),
      ...(filters.to ? { lte: fromDateOnly(filters.to) } : {}),
    };
  }
  const term = filters.search?.trim();
  if (term) {
    // `contains` não escapa curingas do LIKE: busca literal.
    where.code = { contains: term.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" };
  }
  return where;
}

export class PrismaPurchaseReadRepository implements PurchaseReadRepository {
  async list(
    pagination: PaginationRequest,
    filters?: PurchaseListFilters,
  ): Promise<PaginatedResult<PurchaseListItemDTO>> {
    const where = buildWhere(filters);
    const [rows, total] = await Promise.all([
      getDb().purchase.findMany({
        where,
        ...buildPagination(pagination),
        include: {
          supplier: supplierSelect,
          items: { select: { quantity: true, receivedQuantity: true } },
        },
        orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      }),
      getDb().purchase.count({ where }),
    ]);

    return buildPaginatedResult(rows.map(PurchaseReadMapper.toListItemDTO), total, pagination);
  }

  async getById(id: string): Promise<PurchaseDTO | null> {
    const row = await getDb().purchase.findUnique({
      where: { id },
      include: {
        supplier: supplierSelect,
        items: {
          include: { productVariant: { select: { id: true, name: true, code: true, barcode: true } } },
          orderBy: [{ position: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!row) return null;

    // Contas a pagar gerado pelo pedido (origem PURCHASE, originId = pedido).
    const payable = await getDb().financialDocument.findFirst({
      where: { type: "PAYABLE", originType: "PURCHASE", originId: id },
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
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return PurchaseReadMapper.toDetailDTO(row, payable);
  }
}
