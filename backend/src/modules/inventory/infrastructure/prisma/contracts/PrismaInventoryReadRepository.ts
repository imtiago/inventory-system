import { InventoryReadRepository } from "@inventory/application/contracts/InventoryReadRepository";
import { InventoryDTO } from "@inventory/application/dto/InventoryDTO";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { prisma } from "@shared/prisma";

export class PrismaInventoryReadRepository implements InventoryReadRepository {
  async list(
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<InventoryDTO>> {
    const paginationOptions = buildPagination(pagination);

    const [data, total] = await Promise.all([
      prisma.inventory.findMany({
        ...paginationOptions,

        orderBy: {
          name: "asc",
        },
      }),

      prisma.inventory.count(),
    ]);

    const dt = data.map((d) => ({
      id: d.id,
      availableQuantity: d.quantity - d.reservedQuantity,
      createdAt: d.createdAt,
      minimumStock: d.minimumStock,
      productVariantId: d.productVariantId,
      quantity: d.quantity,
      reservedQuantity: d.reservedQuantity,
    }));
    return buildPaginatedResult(dt, total, pagination);
  }

  async getById(id: string): Promise<InventoryDTO | null> {
    const data = await prisma.inventory.findUnique({
      where: { id },
    });

    if (!data) return null;

    return {
      id: data.id,
      availableQuantity: data.quantity - data.reservedQuantity,
      createdAt: data.createdAt,
      minimumStock: data.minimumStock,
      productVariantId: data.productVariantId,
      quantity: data.quantity,
      reservedQuantity: data.reservedQuantity,
    };
  }

  async getByVariantId(id: string): Promise<InventoryDTO | null> {
    const data = await prisma.inventory.findUnique({
      where: {
        productVariantId: id,
      },
    });

    if (!data) return null;

    return {
      id: data.id,
      availableQuantity: data.quantity - data.reservedQuantity,
      createdAt: data.createdAt,
      minimumStock: data.minimumStock,
      productVariantId: data.productVariantId,
      quantity: data.quantity,
      reservedQuantity: data.reservedQuantity,
    };
  }
}
