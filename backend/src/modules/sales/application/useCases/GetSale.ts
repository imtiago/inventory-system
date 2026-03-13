import { SaleRepository } from "../../domain/repositories/SaleRepository";

export class GetSale {
  constructor(private saleRepo: SaleRepository) {}

  async execute(id: string) {
    return this.saleRepo.getById(id);
  }
}
