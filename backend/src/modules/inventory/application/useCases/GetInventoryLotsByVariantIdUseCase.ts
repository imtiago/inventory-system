import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { InventoryLotDTO } from "../dto/InventoryLotDTO";
import { InventoryLotReadRepository } from "../contracts/InventoryLotReadRepository";
import { PaginationParams } from "@shared/application/pagination";

interface GetInventoryLotsByVariantIdRequest extends PaginationParams {
  productVariantId: string;
}

export class GetInventoryLotsByVariantIdUseCase extends TransactionalUseCase<
  GetInventoryLotsByVariantIdRequest,
  InventoryLotDTO
> {
  constructor(
    private readonly inventoryLotRepository: InventoryLotReadRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: GetInventoryLotsByVariantIdRequest,
    tx: Prisma.TransactionClient,
  ): Promise<InventoryLotDTO> {
    let data = await this.inventoryLotRepository.getByVariantId(
      {
        page: request.page,
        limit: request.limit,
      },
      { producVariantId: request.productVariantId },
    );
    return data;
  }
}
