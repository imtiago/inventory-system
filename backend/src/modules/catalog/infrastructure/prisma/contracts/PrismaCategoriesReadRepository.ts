import { CategoriesReadRepository } from "@catalog/application/contracts/CategoriesReadRepository";
import { CategoriesListDTO } from "@catalog/application/dto/CategoryDTO";
import { CategoriesReadMapper } from "@catalog/application/mappers/CategoriesReadMapper";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

export class PrismaCategoriesReadRepository implements CategoriesReadRepository {
  async list(
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<CategoriesListDTO>> {
    const paginationOptions = buildPagination(pagination);

    const [categories, total] = await Promise.all([
      getDb().category.findMany({
        ...paginationOptions,
        orderBy: {
          name: "asc",
        },
      }),
      getDb().category.count(),
    ]);

    const dt = categories.map((category) =>
      CategoriesReadMapper.toDTO(category),
    );
    return buildPaginatedResult(dt, total, pagination);
  }

  async getById(id: string): Promise<CategoriesListDTO | null> {
    const category = await getDb().category.findUnique({
      where: { id },
    });

    if (!category) return null;

    return CategoriesReadMapper.toDTO(category);
  }
}
