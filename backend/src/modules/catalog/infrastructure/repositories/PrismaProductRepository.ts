import { prisma } from "../../../../shared/prisma";

import { ProductRepository } from "../../domain/repositories/ProductRepository";
import { Product } from "../../domain/entities/Product";

import { ProductMapper } from "../mappers/ProductMapper";

export class PrismaProductRepository implements ProductRepository {
  async create(product: Product): Promise<Product> {
    const created = await prisma.product.create({
      data: ProductMapper.toCreatePersistence(product),
    });

    return ProductMapper.toDomain(created);
  }

  async update(product: Product): Promise<Product> {
    const updated = await prisma.product.update({
      where: {
        id: product.id,
      },
      data: ProductMapper.toUpdatePersistence(product),
    });

    return ProductMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await prisma.product.delete({
      where: {
        id,
      },
    });
  }

  async findById(id: string): Promise<Product | null> {
    const product = await prisma.product.findUnique({
      where: {
        id,
      },
    });

    if (!product) {
      return null;
    }

    return ProductMapper.toDomain(product);
  }

  async findByCode(code: string): Promise<Product | null> {
    const product = await prisma.product.findUnique({
      where: {
        code,
      },
    });

    if (!product) {
      return null;
    }

    return ProductMapper.toDomain(product);
  }

  async list(page: number, limit: number): Promise<Product[]> {
    const skip = (page - 1) * limit;

    const products = await prisma.product.findMany({
      skip,
      take: limit,
    });

    return products.map(ProductMapper.toDomain);
  }
}
