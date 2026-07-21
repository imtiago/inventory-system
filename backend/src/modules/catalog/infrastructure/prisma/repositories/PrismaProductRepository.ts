import { Product } from "@catalog/domain/entities/Product";

import { ProductMapper } from "../mappers/ProductMapper";
import { ProductListDTO } from "@catalog/application/dto/ProductListDTO";
import { ProductRepository } from "@catalog/domain/repositories/ProductRepository";
import { prisma } from "@shared/prisma";

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

  async findProductsForList(): Promise<ProductListDTO[]> {
    const products = await prisma.product.findMany({
      include: {
        brand: true,

        category: true,
      },
    });

    return products.map((product) => ({
      id: product.id,

      name: product.name,

      description: product.description,

      brand: {
        id: product.brand.id,

        name: product.brand.name,
      },

      category: {
        id: product.category.id,

        name: product.category.name,
      },

      createdAt: product.createdAt,
    }));
  }
}
