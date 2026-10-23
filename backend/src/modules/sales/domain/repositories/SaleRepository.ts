import { Sale } from "../entities/Sale";

export interface SaleRepository {
  create(sale: Sale): Promise<Sale>;
  findById(id: string): Promise<Sale | null>;
  /** Trava a linha da venda (FOR UPDATE) e a lê; null se não existir. Exige transação. */
  lockById(id: string): Promise<Sale | null>;
  /** Grava o status da venda. */
  update(sale: Sale): Promise<Sale>;
}
