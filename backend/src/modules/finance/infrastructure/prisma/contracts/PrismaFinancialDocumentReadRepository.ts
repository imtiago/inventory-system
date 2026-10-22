import { FinancialDocumentReadRepository } from "@finance/application/contracts/FinancialDocumentReadRepository";
import { FinancialDocumentDTO } from "@finance/application/dto/FinancialDocumentDTO";
import { FinancialDocumentReadMapper } from "@finance/application/mappers/FinancialDocumentReadMapper";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

export class PrismaFinancialDocumentReadRepository implements FinancialDocumentReadRepository {
  async listReceivables(
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<FinancialDocumentDTO>> {
    const paginationOptions = buildPagination(pagination);

    const [financialDocuments, total] = await Promise.all([
      getDb().financialDocument.findMany({
        ...paginationOptions,

        where: {
          type: "RECEIVABLE",
        },
        include: {
          parcels: {
            include: {
              payments: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
      getDb().financialDocument.count({
        where: {
          type: "RECEIVABLE",
        },
      }),
    ]);

    const dt = financialDocuments.map((financialDocument) =>
      FinancialDocumentReadMapper.toDTO(financialDocument),
    );
    return buildPaginatedResult(dt, total, pagination);
  }
}
