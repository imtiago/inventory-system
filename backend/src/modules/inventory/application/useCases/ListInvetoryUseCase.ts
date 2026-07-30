import { PaginationParams } from "@shared/application/pagination";
import { InventoryReadRepository } from "../contracts/InventoryReadRepository";

export class ListInvetoryUseCase {
  constructor(private repository: InventoryReadRepository) {}

  async execute({ page, limit }: PaginationParams) {
    return this.repository.list({ page, limit });
  }
}
