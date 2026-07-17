import { Prisma, SaleStatus } from "@prisma/client";
import { Sale } from "../entities/Sale";

export interface SaleRepository {
  create(sale: Sale, tx?: Prisma.TransactionClient): Promise<Sale>;
  list(page: number, limit: number): Promise<Sale[]>;
  findById(id: string, tx?: Prisma.TransactionClient): Promise<Sale | null>;
  updateStatus(
    id: string,
    status: SaleStatus,
    tx?: Prisma.TransactionClient,
  ): Promise<Sale>;
}
