import { prisma } from "../../../../shared/prisma";
import { BrandRepository } from "../../domain/repositories/BrandRepository";
import { Brand } from "../../domain/entities/Brand";
import { BrandMapper } from "../mappers/BrandMapper";

export class PrismaBrandRepository implements BrandRepository {
  async create(brand: Brand): Promise<Brand> {
    const created = await prisma.brand.create({
      data: BrandMapper.toCreatePersistence(brand),
    });

    return BrandMapper.toDomain(created);
  }

  async list(page: number, limit: number): Promise<Brand[]> {
    const skip = (page - 1) * limit;

    const brands = await prisma.brand.findMany({
      skip,
      take: limit,
    });

    return brands.map(BrandMapper.toDomain);
  }

  async findById(id: string): Promise<Brand | null> {
    const brand = await prisma.brand.findUnique({
      where: { id },
    });

    if (!brand) {
      return null;
    }

    return BrandMapper.toDomain(brand);
  }
}
