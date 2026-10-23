import { Brand } from "@catalog/domain/entities/Brand";
import { Brand as PrismaBrand, Prisma } from "@prisma/client";

export class BrandMapper {
  static toDomain(row: PrismaBrand): Brand {
    return new Brand({ id: row.id, name: row.name, createdAt: row.createdAt });
  }

  static toCreatePersistence(brand: Brand): Prisma.BrandUncheckedCreateInput {
    return { id: brand.id, name: brand.name, createdAt: brand.createdAt };
  }

  static toUpdatePersistence(brand: Brand): Prisma.BrandUncheckedUpdateInput {
    return { name: brand.name };
  }
}
