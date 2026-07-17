import { PrismaClient, SaleStatus } from "@prisma/client";
import { prisma } from "../../../../shared/prisma";
import { Sale } from "../../domain/entities/Sale";
import { SaleRepository } from "modules/sales/domain/repositories/SaleRepository";

export class PrismaSaleRepository implements SaleRepository {
  async create(sale: Sale, tx: PrismaClient = prisma): Promise<Sale> {
    return tx.sale.create({
      data: {
        id: sale.id,
        customerId: sale.customerId,
        totalAmount: sale.totalAmount,
        items: {
          create: sale.items.map((item) => ({
            productVariantId: item.productVariantId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
      include: {
        items: true,
      },
    });
  }

  async list(page: number, limit: number): Promise<Sale[]> {
    const skip = (page - 1) * limit;
    const sales = await prisma.sale.findMany({
      skip,
      take: limit,
      include: { items: true },
    });

    return sales as unknown as Sale[];
  }

  async findById(id: string, tx = prisma) {
    return tx.sale.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });
  }

  async updateStatus(id: string, status: SaleStatus, tx = prisma) {
    return tx.sale.update({
      where: { id },
      data: { status },
    });
  }
}
