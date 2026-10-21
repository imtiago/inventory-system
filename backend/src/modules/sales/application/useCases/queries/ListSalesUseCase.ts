import { PaginationParams } from "@shared/application/pagination";
import { SaleReadRepository } from "../../contracts/SaleReadRepository";

export class ListSalesUseCase {
  constructor(private saleRepo: SaleReadRepository) {}

  async execute({ page, limit }: PaginationParams) {
    return this.saleRepo.list({
      page,
      limit,
    });
  }
}
