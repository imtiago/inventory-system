import { PaginationParams } from "@shared/application/pagination";
import { SaleReadRepository } from "../contracts/SaleReadRepository";

export class ListSales {
  constructor(private saleRepo: SaleReadRepository) {}

  async execute({ page, limit }: PaginationParams) {
    return this.saleRepo.list({
      page,
      limit,
    });
  }
}
