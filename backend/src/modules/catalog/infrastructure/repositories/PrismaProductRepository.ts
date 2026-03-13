import { Product } from "../../domain/entities/Product";
import { ProductVariant } from "../../domain/entities/ProductVariant";
import { ProductRepository } from "../../domain/repositories/ProductRepository";
import { prisma } from "../../../../shared/prisma";

export class PrismaProductRepository implements ProductRepository {
  // Cria produto
  async create(product: Product): Promise<Product> {
    const created = await prisma.product.create({
      data: {
        name: product.name,
        description: product.description,
        brandId: product.brandId,
        categoryId: product.categoryId,
      },
    });

    return new Product({
      id: created.id,
      name: created.name,
      description: created.description ?? undefined,
      brandId: created.brandId,
      categoryId: created.categoryId,
      createdAt: created.createdAt,
    });
  }

  async list(): Promise<Product[]> {
    const products = await prisma.product.findMany();
    return products.map(
      (p) =>
        new Product({
          id: p.id,
          name: p.name,
          description: p.description ?? undefined,
          brandId: p.brandId,
          categoryId: p.categoryId,
          createdAt: p.createdAt,
        }),
    );
  }
  // Cria variante
  async createVariant(variant: ProductVariant): Promise<ProductVariant> {
    const created = await prisma.productVariant.create({
      data: {
        name: variant.name,
        sku: variant.sku,
        productId: variant.productId,
      },
    });

    return new ProductVariant({
      id: created.id,
      name: created.name,
      sku: created.sku,
      productId: created.productId,
      createdAt: created.createdAt,
    });
  }

  // Lista variantes de um produto
  async listVariants(productId: string): Promise<ProductVariant[]> {
    const variants = await prisma.productVariant.findMany({
      where: { productId },
    });

    return variants.map(
      (v) =>
        new ProductVariant({
          id: v.id,
          name: v.name,
          sku: v.sku,
          productId: v.productId,
          createdAt: v.createdAt,
        }),
    );
  }

  async findAll(page = 1, limit = 10): Promise<Product[]> {
    const skip = (page - 1) * limit;

    const products = await prisma.product.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return products.map(
      (p) =>
        new Product({
          id: p.id,
          name: p.name,
          description: p.description ?? undefined,
          brandId: p.brandId,
          categoryId: p.categoryId,
          createdAt: p.createdAt,
        }),
    );
  }
}
