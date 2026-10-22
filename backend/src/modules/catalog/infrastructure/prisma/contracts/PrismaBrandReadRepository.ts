import { BrandReadRepository } from "@catalog/application/contracts/BrandReadRepository";
import { BrandListDTO } from "@catalog/application/dto/BrandDTO";
import { BrandReadMapper } from "@catalog/application/mappers/BrandReadMapper";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

export class PrismaBrandReadRepository implements BrandReadRepository {
  async list(
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<BrandListDTO>> {
    const paginationOptions = buildPagination(pagination);

    const [brands, total] = await Promise.all([
      getDb().brand.findMany({
        ...paginationOptions,
        orderBy: {
          name: "asc",
        },
      }),
      getDb().brand.count(),
    ]);

    const dt = brands.map((brand) => BrandReadMapper.toDTO(brand));
    return buildPaginatedResult(dt, total, pagination);
  }

  async getById(id: string): Promise<BrandListDTO | null> {
    const brand = await getDb().brand.findUnique({
      where: { id },
    });

    if (!brand) return null;

    return BrandReadMapper.toDTO(brand);
  }
}
