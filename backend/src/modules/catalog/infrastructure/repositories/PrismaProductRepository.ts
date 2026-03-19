// backend/src/modules/catalog/infrastructure/repositories/PrismaProductRepository.ts
import { prisma } from "../../../../shared/prisma";
import { ProductRepository } from "../../domain/repositories/ProductRepository";
import { Product } from "../../domain/entities/Product";
import { ProductVariant } from "../../domain/entities/ProductVariant";
import { Brand } from "../../domain/entities/Brand";
import { Category } from "../../domain/entities/Category";

export class PrismaProductRepository implements ProductRepository {
  async create(product: Product): Promise<Product> {
    return prisma.product.create({ data: product });
  }

  async list(page: number, limit: number): Promise<Product[]> {
    return prisma.product.findMany({
      skip: (page - 1) * limit,
      take: limit,
      include: {
        brand: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        variants: true,
      },
    });
  }

  async getById(id: string): Promise<Product | null> {
    return prisma.product.findUnique({
      where: { id },
      include: { variants: true },
    });
  }

  // Lista todas as brands
  async listBrands(): Promise<Brand[]> {
    const brands = await prisma.brand.findMany();

    // mapeia para a entidade Brand
    return brands.map(
      (b) =>
        new Brand({
          id: b.id,
          name: b.name,
          createdAt: b.createdAt ?? new Date(), // garante que createdAt exista
        }),
    );
  }

  // Cria uma brand
  async createBrand(brand: Brand): Promise<Brand> {
    const created = await prisma.brand.create({
      data: {
        id: brand.id,
        name: brand.name,
        createdAt: brand.createdAt,
      },
    });

    return new Brand({
      id: created.id,
      name: created.name,
      createdAt: created.createdAt,
    });
  }

  async listCategories(): Promise<Category[]> {
    return prisma.category.findMany();
  }

  async createCategory(category: Category): Promise<Category> {
    return prisma.category.create({ data: category });
  }
  async findAll(): Promise<Product[]> {
    return prisma.product.findMany();
  }

  async createVariant(variant: ProductVariant): Promise<ProductVariant> {
    return prisma.productVariant.create({
      data: {
        id: variant.id,
        productId: variant.productId,
        name: variant.name,
        sku: variant.sku,
        barcode: variant.barcode,
      },
    });
  }

  async findVariantsByProductId(productId: string): Promise<ProductVariant[]> {
    const variants = await prisma.productVariant.findMany({
      where: { productId },
    });

    return variants.map((v) => ({
      ...v,
      barcode: v.barcode ?? undefined, // converte null para undefined
    }));
  }
}
