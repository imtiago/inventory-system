import { SaleReadRepository } from "../contracts/SaleReadRepository";

export class GetSale {
  constructor(private saleRepo: SaleReadRepository) {}

  async execute(id: string) {
    return this.saleRepo.getById(id);
  }
}
