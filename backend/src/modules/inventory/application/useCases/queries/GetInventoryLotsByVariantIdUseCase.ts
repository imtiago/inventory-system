import { InventoryLotDTO } from "../../dto/InventoryLotDTO";
import { InventoryLotReadRepository } from "../../contracts/InventoryLotReadRepository";
import { PaginationParams } from "@shared/application/pagination";
import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";

interface GetInventoryLotsByVariantIdRequest extends PaginationParams {
  productVariantId: string;
}

export class GetInventoryLotsByVariantIdUseCase {
  constructor(
    private readonly inventoryLotRepository: InventoryLotReadRepository,
  ) {}

  async execute(
    request: GetInventoryLotsByVariantIdRequest,
  ): Promise<PaginatedResult<InventoryLotDTO>> {
    return this.inventoryLotRepository.getByVariantId(
      {
        page: request.page,
        limit: request.limit,
      },
      { producVariantId: request.productVariantId },
    );
  }
}
