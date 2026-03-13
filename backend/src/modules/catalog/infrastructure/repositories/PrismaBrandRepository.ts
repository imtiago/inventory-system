// src/modules/catalog/infrastructure/repositories/PrismaBrandRepository.ts
import { prisma } from "../../../../shared/prisma";
import { BrandRepository } from "../../domain/repositories/BrandRepository";
import { Brand } from "../../domain/entities/Brand";

export class PrismaBrandRepository implements BrandRepository {
  async create(brand: Brand): Promise<Brand> {
    const created = await prisma.brand.create({
      data: { id: brand.id, name: brand.name, createdAt: brand.createdAt },
    });
    return created as unknown as Brand;
  }

  async list(page: number, limit: number): Promise<Brand[]> {
    const skip = (page - 1) * limit;
    const brands = await prisma.brand.findMany({
      skip,
      take: limit,
    });
    return brands as unknown as Brand[];
  }
}
