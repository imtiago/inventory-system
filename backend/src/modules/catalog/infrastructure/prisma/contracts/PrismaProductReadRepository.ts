import { readTogether } from "@shared/infrastructure/database/readTogether";
import { Prisma } from "@prisma/client";
import { ProductListFilters } from "@catalog/application/contracts/ProductListFilters";
import { ProductReadRepository } from "@catalog/application/contracts/ProductReadRepository";
import { ProductDetailDTO, ProductListItemDTO } from "@catalog/application/dto/ProductDTO";
import { ProductReadMapper } from "@catalog/application/mappers/ProductReadMapper";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { containsLiteral } from "@shared/infrastructure/database/literalSearch";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";

const productReadInclude = {
  brand: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  _count: { select: { variants: true } },
} satisfies Prisma.ProductInclude;

function buildWhere(filters?: ProductListFilters): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];
  const search = filters?.search?.trim();
  if (search) {
    const contains = containsLiteral(search);
    and.push({
      OR: [
        { name: contains },
        { code: contains },
        { variants: { some: { barcode: contains } } },
      ],
    });
  }
  if (filters?.brandId) and.push({ brandId: filters.brandId });
  if (filters?.categoryId) and.push({ categoryId: filters.categoryId });
  return and.length > 0 ? { AND: and } : {};
}

export class PrismaProductReadRepository implements ProductReadRepository {
  async list(
    pagination: PaginationRequest,
    filters?: ProductListFilters,
  ): Promise<PaginatedResult<ProductListItemDTO>> {
    const where = buildWhere(filters);

    const [products, total] = await readTogether([
      getDb().product.findMany({
        ...buildPagination(pagination),
        where,
        include: productReadInclude,
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      getDb().product.count({ where }),
    ]);

    return buildPaginatedResult(products.map(ProductReadMapper.toDTO), total, pagination);
  }

  async getById(id: string): Promise<ProductDetailDTO | null> {
    const product = await getDb().product.findUnique({
      where: { id },
      include: productReadInclude,
    });

    return product ? ProductReadMapper.toDTO(product) : null;
  }
}
