import { ErrorCodes, NotFoundError } from "@shared/domain/errors";
import { SaleReadRepository } from "../../contracts/SaleReadRepository";

export class GetSaleByIdUseCase {
  constructor(private saleRepo: SaleReadRepository) {}

  async execute(id: string) {
    const sale = await this.saleRepo.getById(id);
    if (!sale) throw new NotFoundError("Venda não encontrada.", ErrorCodes.SALE_NOT_FOUND);
    return sale;
  }
}
