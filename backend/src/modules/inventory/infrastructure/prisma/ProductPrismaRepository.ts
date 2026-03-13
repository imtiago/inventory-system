import { prisma } from "@/shared/database/prisma";
import { ProductRepository } from "../../domain/repositories/ProductRepository";
import { Product } from "../../domain/entities/Product";

export class ProductPrismaRepository implements ProductRepository {
  async create(product: Product): Promise<Product> {
    const created = await prisma.product.create({
      data: {
        id: product.id,
        name: product.name,
        description: product.description,
      },
    });

    return new Product(
      created.id,
      created.name,
      created.description ?? undefined,
    );
  }

  async findById(id: string): Promise<Product | null> {
    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) return null;

    return new Product(
      product.id,
      product.name,
      product.description ?? undefined,
    );
  }

  async findAll(): Promise<Product[]> {
    const products = await prisma.product.findMany();

    return products.map(
      (p) => new Product(p.id, p.name, p.description ?? undefined),
    );
  }
}
