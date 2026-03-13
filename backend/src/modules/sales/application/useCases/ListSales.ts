import { SaleRepository } from "../../domain/repositories/SaleRepository";

export class ListSales {
  constructor(private saleRepo: SaleRepository) {}

  async execute(page: number, limit: number) {
    return this.saleRepo.list(page, limit);
  }
}
