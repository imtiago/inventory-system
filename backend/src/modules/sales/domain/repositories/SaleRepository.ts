import { Prisma, SaleStatus } from "@prisma/client";
import { Sale } from "../entities/Sale";

export interface SaleRepository {
  save(sale: Sale, tx?: Prisma.TransactionClient): Promise<Sale>;

  findById(id: string): Promise<Sale | null>;
}
