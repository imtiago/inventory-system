import { SaleReadRepository } from "@sales/application/contracts/SaleReadRepository";
import { SaleDetailsDTO } from "@sales/application/dto/SaleDTO";
import { prisma } from "@shared/prisma";

export class PrismaSaleReadRepository implements SaleReadRepository {
  async list(): Promise<SaleDetailsDTO[]> {
    const sales = await prisma.sale.findMany({
      include: {
        customer: true,
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return sales.map((sale) => ({
      id: sale.id,
      createdAt: sale.createdAt,
      totalAmount: sale.totalAmount,
      status: sale.status,

      customer: {
        id: sale.customer.id,
        name: sale.customer.name,
      },

      items: sale.items.map((item) => ({
        id: item.id,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.quantity * item.price,
      })),
    }));
  }

  async getById(id: string): Promise<SaleDetailsDTO | null> {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            productVariant: true,
          },
        },
      },
    });

    if (!sale) {
      return null;
    }

    return {
      id: sale.id,
      createdAt: sale.createdAt,
      totalAmount: sale.totalAmount,
      status: sale.status,

      customer: {
        id: sale.customer.id,
        name: sale.customer.name,
      },

      items: sale.items.map((item) => ({
        id: item.id,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.quantity * item.price,
      })),
    };
  }
}
