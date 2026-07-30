import { FinancialDocumentReadRepository } from "@finance/application/contracts/FinancialDocumentReadRepository";
import { FinancialDocumentDTO } from "@finance/application/dto/FinancialDocumentDTO";
import { FinancialDocumentReadMapper } from "@finance/application/mappers/FinancialDocumentReadMapper";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { prisma } from "@shared/prisma";

export class PrismaFinancialDocumentReadRepository implements FinancialDocumentReadRepository {
  async listReceivables(
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<FinancialDocumentDTO>> {
    const paginationOptions = buildPagination(pagination);

    const [financialDocuments, total] = await prisma.$transaction([
      prisma.financialDocument.findMany({
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
      prisma.financialDocument.count({
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
