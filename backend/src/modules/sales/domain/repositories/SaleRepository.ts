import { Prisma, SaleStatus } from "@prisma/client";
import { Sale } from "../entities/Sale";
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";

export interface SaleRepository extends ICrudRepository<Sale> {
  // create(sale: Sale, tx?: Prisma.TransactionClient): Promise<Sale>;
  // findById(id: string): Promise<Sale | null>;
}
