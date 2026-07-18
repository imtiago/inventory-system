// src/modules/sales/infrastructure/mappers/SaleMapper.ts

import { Sale } from "../../domain/entities/Sale";
import { Sale as PrismaSale, Prisma } from "@prisma/client";

import { SaleItemMapper } from "./SaleItemMapper";
import { SaleStatusMapper } from "./SaleStatusMapper";

export class SaleMapper {
  // Banco -> Domínio

  static toDomain(
    prisma: PrismaSale & {
      items?: any[];
    },
  ): Sale {
    return new Sale({
      id: prisma.id,

      customerId: prisma.customerId,

      status: SaleStatusMapper.toDomain(prisma.status),

      createdAt: prisma.createdAt,

      items: prisma.items?.map(SaleItemMapper.toDomain) ?? [],
    });
  }

  // Domínio -> Banco

  static toCreatePersistence(sale: Sale): Prisma.SaleCreateInput {
    return {
      id: sale.id,

      totalAmount: sale.totalAmount,

      status: SaleStatusMapper.toPrisma(sale.status),

      createdAt: sale.createdAt,

      customer: {
        connect: {
          id: sale.customerId,
        },
      },

      items: {
        create: sale.items.map(SaleItemMapper.toCreatePersistence),
      },
    };
  }

  // Update

  static toUpdatePersistence(sale: Sale): Prisma.SaleUpdateInput {
    return {
      status: SaleStatusMapper.toPrisma(sale.status),

      totalAmount: sale.totalAmount,
    };
  }
}
