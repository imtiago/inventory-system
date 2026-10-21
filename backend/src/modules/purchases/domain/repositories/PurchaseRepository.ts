import { Purchase } from "../entities/Purchase";

export interface PurchaseRepository {
  create(brand: Purchase): Promise<Purchase>;
  list(page: number, limit: number): Promise<Purchase[]>;
  findById(id: string): Promise<Purchase | null>;
}
