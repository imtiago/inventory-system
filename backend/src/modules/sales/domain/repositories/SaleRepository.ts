import { Sale } from "../entities/Sale";

export interface SaleRepository {
  create(sale: Sale): Promise<Sale>;
  list(page: number, limit: number): Promise<Sale[]>;
  getById(id: string): Promise<Sale | null>;
}
