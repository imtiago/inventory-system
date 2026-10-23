import { SaleReadRepository } from "@sales/application/contracts/SaleReadRepository";
import { SaleDetailDTO, SaleListItemDTO } from "@sales/application/dto/SaleDTO";
import { SaleReadMapper } from "@sales/application/mappers/SaleReadMapper";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

const personSelect = { select: { id: true, name: true } } as const;

export class PrismaSaleReadRepository implements SaleReadRepository {
  async list(pagination: PaginationRequest): Promise<PaginatedResult<SaleListItemDTO>> {
    const paginationOptions = buildPagination(pagination);
    const [sales, total] = await Promise.all([
      getDb().sale.findMany({
        ...paginationOptions,
        include: {
          customer: personSelect,
          _count: { select: { items: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
      getDb().sale.count(),
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
