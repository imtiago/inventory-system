import { Sale } from "../entities/Sale";
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";

export interface SaleRepository extends ICrudRepository<Sale> {
  // create(sale: Sale): Promise<Sale>;
  // findById(id: string): Promise<Sale | null>;
}
