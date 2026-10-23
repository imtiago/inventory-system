import { Sale } from "../entities/Sale";

export interface SaleRepository {
  create(sale: Sale): Promise<Sale>;
  findById(id: string): Promise<Sale | null>;
}
