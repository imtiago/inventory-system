// infrastructure/prisma/queries/PrismaProductQuery.ts

import { ProductVariantReadRepository } from "@catalog/application/contracts/ProductVariantReadRepository";
import { ProductVariantDTO } from "@catalog/application/dto/ProductVariantDTO";
import { ProductVariantReadMapper } from "@catalog/application/mappers/ProductVariantReadMapper";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { buildPaginatedResult } from "@shared/infrastructure/database/buildPaginatedResult";
import { buildPagination } from "@shared/infrastructure/database/buildPagination";
import { prisma } from "@shared/prisma";

export class PrismaProductVariantReadRepository implements ProductVariantReadRepository {
  async getByProductId(
    productId: string,
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<ProductVariantDTO>> {
    const paginationOptions = buildPagination(pagination);

    const [productsVariant, total] = await prisma.$transaction([
      prisma.productVariant.findMany({
        ...paginationOptions,
        where: {
          productId,
        },
        include: {
          product: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
      prisma.productVariant.count({
        where: {
          productId,
        },
      }),
    ]);
    const dt = productsVariant.map((variant) =>
      ProductVariantReadMapper.toDTO(variant),
    );
    return buildPaginatedResult(dt, total, pagination);
  }

  async list(
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<ProductVariantDTO>> {
    const paginationOptions = buildPagination(pagination);

    const [productsVariant, total] = await prisma.$transaction([
      prisma.productVariant.findMany({
        ...paginationOptions,
        include: {
          product: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
      prisma.productVariant.count(),
    ]);
    const dt = productsVariant.map((variant) =>
      ProductVariantReadMapper.toDTO(variant),
    );

    return buildPaginatedResult(dt, total, pagination);
  }

  async getById(id: string): Promise<ProductVariantDTO | null> {
    const variant = await prisma.productVariant.findUnique({
      where: { id },
      include: {
        product: true,
      },
    });

    if (!variant) return null;

    return ProductVariantReadMapper.toDTO(variant);
  }
}
