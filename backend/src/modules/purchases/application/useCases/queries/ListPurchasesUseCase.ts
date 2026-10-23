import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PurchaseListFilters, PurchaseReadRepository } from "../../contracts/PurchaseReadRepository";
import { PurchaseListItemDTO } from "../../dto/PurchaseDTO";

export interface ListPurchasesParams extends PurchaseListFilters {
  page: number;
  limit: number;
}

export class ListPurchasesUseCase {
  constructor(private readonly purchases: PurchaseReadRepository) {}

  async execute({ page, limit, ...filters }: ListPurchasesParams): Promise<PaginatedResult<PurchaseListItemDTO>> {
    return this.purchases.list({ page, limit }, filters);
  }
}
