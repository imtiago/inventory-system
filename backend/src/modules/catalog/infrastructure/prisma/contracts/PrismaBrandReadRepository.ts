// infrastructure/prisma/queries/PrismaProductQuery.ts

import { BrandReadRepository } from "@catalog/application/contracts/BrandReadRepository";
import { BrandListDTO } from "@catalog/application/dto/BrandListDTO";
import { prisma } from "@shared/prisma";

export class PrismaBrandReadRepository implements BrandReadRepository {
  async list(): Promise<BrandListDTO[]> {
    const brands = await prisma.brand.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return brands.map((brand) => ({
      id: brand.id,

      name: brand.name,
    }));
  }

  async getById(id: string): Promise<BrandListDTO | null> {
    const brand = await prisma.brand.findUnique({
      where: { id },
    });

    if (!brand) return null;

    return {
      id: brand.id,

      name: brand.name,
    };
  }
}
