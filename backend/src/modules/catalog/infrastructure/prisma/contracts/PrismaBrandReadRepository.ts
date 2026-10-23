import { BrandReadRepository } from "@catalog/application/contracts/BrandReadRepository";
import { NameSearchFilters } from "@catalog/application/contracts/NameSearchFilters";
import { BrandDTO } from "@catalog/application/dto/BrandDTO";
import { BrandReadMapper } from "@catalog/application/mappers/BrandReadMapper";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { listWithProductsCount } from "../brandCategorySql";

export class PrismaBrandReadRepository implements BrandReadRepository {
  async list(pagination: PaginationRequest, filters?: NameSearchFilters): Promise<PaginatedResult<BrandDTO>> {
    const result = await listWithProductsCount("brand", pagination, filters?.search);
    return { ...result, data: result.data.map(BrandReadMapper.toDTO) };
  }

  async getById(id: string): Promise<BrandDTO | null> {
    const brand = await getDb().brand.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { products: true } } },
    });
    return brand
      ? BrandReadMapper.toDTO({ id: brand.id, name: brand.name, productsCount: brand._count.products })
      : null;
  }
}
