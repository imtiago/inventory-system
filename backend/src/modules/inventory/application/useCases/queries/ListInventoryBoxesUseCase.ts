import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationParams } from "@shared/application/pagination";
import { InventoryBoxReadRepository } from "../../contracts/InventoryBoxReadRepository";
import { InventoryBoxDTO } from "../../dto/InventoryBoxDTO";

export interface IListInventoryBoxesInput extends PaginationParams {
  search?: string;
}

export class ListInventoryBoxesUseCase {
  constructor(private readonly repository: InventoryBoxReadRepository) {}

  async execute(
    request: IListInventoryBoxesInput,
  ): Promise<PaginatedResult<InventoryBoxDTO>> {
    return this.repository.list(
      { page: request.page, limit: request.limit },
      { search: request.search || undefined },
    );
  }
}
