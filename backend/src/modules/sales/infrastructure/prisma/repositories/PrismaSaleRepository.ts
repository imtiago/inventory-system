import { SaleMapper } from "../mappers/SaleMapper";
import { getDb } from "@shared/infrastructure/prisma/transactionContext";
import { Sale } from "@sales/domain/entities/Sale";
import { SaleRepository } from "@sales/domain/repositories/SaleRepository";

export class PrismaSaleRepository implements SaleRepository {
  async create(sale: Sale): Promise<Sale> {
    const created = await getDb().sale.create({
      data: SaleMapper.toCreatePersistence(sale),
      include: { items: true },
    });
    return SaleMapper.toDomain(created);
  }

  async findById(id: string): Promise<Sale | null> {
    const sale = await getDb().sale.findUnique({
      where: { id },
      include: { items: true },
    });
    return sale ? SaleMapper.toDomain(sale) : null;
  }
}
