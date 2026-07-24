import { FinancialDocumentReadRepository } from "@finance/application/contracts/FinancialDocumentReadRepository";
import { FinancialDocumentDTO } from "@finance/application/dto/FinancialDocumentDTO";
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

    const dt = financialDocuments.map((financialDocument) => {
      const totalAmount = financialDocument.parcels.reduce(
        (total, parcel) => total + Number(parcel.amount),
        0,
      );

      return {
        id: financialDocument.id,

        type: financialDocument.type,

        originId: financialDocument.originId,
        originType: financialDocument.originType,

        partyId: financialDocument.partyId,
        partyType: financialDocument.partyType,

        status: financialDocument.status,

        createdAt: financialDocument.createdAt,

        totalAmount,

        parcels: financialDocument.parcels.map((parcel) => {
          const paidAmount = parcel.payments.reduce(
            (total, payment) => total + Number(payment.amount),
            0,
          );

          const remainingAmount = Number(parcel.amount) - paidAmount;

          let status = "OPEN";

          if (paidAmount >= Number(parcel.amount)) {
            status = "PAID";
          } else if (paidAmount > 0) {
            status = "PARTIALLY_PAID";
          } else if (parcel.dueDate < new Date()) {
            status = "OVERDUE";
          }

          return {
            id: parcel.id,

            amount: Number(parcel.amount),

            dueDate: parcel.dueDate,

            paidAmount,

            remainingAmount,

            status,

            payments: parcel.payments.map((payment) => ({
              id: payment.id,

              amount: Number(payment.amount),

              method: payment.method,

              reference: payment.reference,

              paymentDate: payment.paymentDate,
            })),
          };
        }),
      };
    });
    return buildPaginatedResult(dt, total, pagination);
  }
}
