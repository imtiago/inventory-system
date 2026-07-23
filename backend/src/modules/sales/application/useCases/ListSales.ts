import { SaleReadRepository } from "../contracts/SaleReadRepository";

export class ListSales {
  constructor(private saleRepo: SaleReadRepository) {}

  async execute() {
    // async execute(page: number, limit: number) {
    //   return this.saleRepo.list(page, limit);
    return this.saleRepo.list();
  }
}
