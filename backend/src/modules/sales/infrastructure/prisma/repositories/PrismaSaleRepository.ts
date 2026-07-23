// src/modules/sales/infrastructure/repositories/PrismaSaleRepository.ts

import { Prisma, SaleStatus } from "@prisma/client";

import { SaleMapper } from "../mappers/SaleMapper";
import { SaleStatusMapper } from "../mappers/SaleStatusMapper";
import { prisma } from "@shared/prisma";
import { Sale } from "@sales/domain/entities/Sale";
import { SaleRepository } from "@sales/domain/repositories/SaleRepository";

export class PrismaSaleRepository implements SaleRepository {
  async create(
    sale: Sale,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<Sale> {
    const created = await tx.sale.create({
      data: SaleMapper.toCreatePersistence(sale),
      include: {
        items: true,
      },
    });
    return SaleMapper.toDomain(created);
  }
  async list(page: number, limit: number): Promise<Sale[]> {
    const skip = (page - 1) * limit;

    const sales = await prisma.sale.findMany({
      skip,
      take: limit,
      include: {
        items: true,
      },
    });

    return sales.map(SaleMapper.toDomain);
  }

  async findById(
    id: string,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<Sale | null> {
    const sale = await tx.sale.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!sale) {
      return null;
    }

    return SaleMapper.toDomain(sale);
  }

  async updateStatus(
    id: string,
    status: SaleStatus,
    tx: Prisma.TransactionClient = prisma,
  ): Promise<Sale> {
    const updated = await tx.sale.update({
      where: { id },
      data: {
        status: SaleStatusMapper.toPrisma(status),
      },
      include: {
        items: true,
      },
    });

    return SaleMapper.toDomain(updated);
  }
}
