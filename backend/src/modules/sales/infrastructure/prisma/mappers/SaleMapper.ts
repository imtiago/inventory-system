import { Sale as PrismaSale, SaleItem as PrismaSaleItem, Prisma } from "@prisma/client";
import { SaleItemMapper } from "./SaleItemMapper";
import { SaleStatusMapper } from "./SaleStatusMapper";
import { Sale } from "@sales/domain/entities/Sale";
import { fromCents } from "@shared/domain/money";

export class SaleMapper {
  // Banco -> Domínio
  static toDomain(prisma: PrismaSale & { items: PrismaSaleItem[] }): Sale {
    return new Sale({
      id: prisma.id,
      customerId: prisma.customerId,
      sellerId: prisma.sellerId,
      status: SaleStatusMapper.toDomain(prisma.status),
      createdAt: prisma.createdAt,
      items: prisma.items.map(SaleItemMapper.toDomain),
    });
  }

  // Domínio -> Banco
  static toCreatePersistence(sale: Sale): Prisma.SaleUncheckedCreateInput {
    return {
      id: sale.id,
      customerId: sale.customerId,
      sellerId: sale.sellerId,
      totalAmount: fromCents(sale.totalAmountCents),
      status: SaleStatusMapper.toPrisma(sale.status),
      createdAt: sale.createdAt,
      items: {
        create: sale.items.map(SaleItemMapper.toCreatePersistence),
      },
    };
  }
}
