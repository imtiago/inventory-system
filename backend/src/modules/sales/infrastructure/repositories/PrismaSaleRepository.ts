import { prisma } from "../../../../shared/prisma";
import { Sale } from "../../domain/entities/Sale";

export class PrismaSaleRepository {
  async create(sale: Sale): Promise<Sale> {
    const created = await prisma.sale.create({
      data: {
        id: sale.id,
        customerId: sale.customerId,
        totalAmount: sale.totalAmount,
        createdAt: sale.createdAt,
        items: {
          create: sale.items.map((i) => ({
            productVariantId: i.productVariantId,
            quantity: i.quantity,
            price: i.price,
          })),
        },
      },
      include: { items: true },
    });

    return created as unknown as Sale;
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

  async getById(id: string): Promise<Sale | null> {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });
    return sale as unknown as Sale | null;
  }
}
