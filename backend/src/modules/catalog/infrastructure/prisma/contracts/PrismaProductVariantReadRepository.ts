import { ProductVariantReadRepository } from "@catalog/application/contracts/ProductVariantReadRepository";
import { ProductVariantDTO } from "@catalog/application/dto/ProductVariantDTO";
import { ProductVariantReadMapper } from "@catalog/application/mappers/ProductVariantReadMapper";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

export class PrismaProductVariantReadRepository implements ProductVariantReadRepository {
  async getByProductId(
    productId: string,
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<ProductVariantDTO>> {
    const paginationOptions = buildPagination(pagination);

    const [productsVariant, total] = await Promise.all([
      getDb().productVariant.findMany({
        ...paginationOptions,
        where: {
          productId,
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      getDb().productVariant.count({
        where: {
          productId,
        },
      }),
    ]);
    const dt = productsVariant.map((variant) =>
      ProductVariantReadMapper.toDTO(variant),
    );
    return buildPaginatedResult(dt, total, pagination);
  }

  async getById(id: string): Promise<ProductVariantDTO | null> {
    const variant = await getDb().productVariant.findUnique({
      where: { id },
    });

    if (!variant) return null;

    return ProductVariantReadMapper.toDTO(variant);
  }
  async getByBarcode(barcode: string) {
    const variant = await getDb().productVariant.findUnique({
      where: { barcode },
    });

    if (!variant) return null;

    return ProductVariantReadMapper.toDTO(variant);
  }
}
