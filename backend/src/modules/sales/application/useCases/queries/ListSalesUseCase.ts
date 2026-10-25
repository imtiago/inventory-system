import { PaginationParams } from "@shared/application/pagination";
import { SaleListFilter, SaleReadRepository } from "../../contracts/SaleReadRepository";

export class ListSalesUseCase {
  constructor(private saleRepo: SaleReadRepository) {}

  async execute({ page, limit }: PaginationParams, filter: SaleListFilter = {}) {
    return this.saleRepo.list({ page, limit }, filter);
  }
}
