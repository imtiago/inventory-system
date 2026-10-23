import { CategoryReadRepository } from "@catalog/application/contracts/CategoryReadRepository";
import { NameSearchFilters } from "@catalog/application/contracts/NameSearchFilters";
import { CategoryDTO } from "@catalog/application/dto/CategoryDTO";
import { CategoryReadMapper } from "@catalog/application/mappers/CategoryReadMapper";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { listWithProductsCount } from "../brandCategorySql";

export class PrismaCategoryReadRepository implements CategoryReadRepository {
  async list(pagination: PaginationRequest, filters?: NameSearchFilters): Promise<PaginatedResult<CategoryDTO>> {
    const result = await listWithProductsCount("category", pagination, filters?.search);
    return { ...result, data: result.data.map(CategoryReadMapper.toDTO) };
  }

  async getById(id: string): Promise<CategoryDTO | null> {
    const category = await getDb().category.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { products: true } } },
    });
    return category
      ? CategoryReadMapper.toDTO({ id: category.id, name: category.name, productsCount: category._count.products })
      : null;
  }
}
