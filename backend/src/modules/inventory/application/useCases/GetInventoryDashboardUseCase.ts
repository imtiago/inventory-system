import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { InventoryReadRepository } from "../contracts/InventoryReadRepository";
import { InventoryDashboardDTO } from "../dto/InventoryDashboardDTO";

interface GetInventoryDashboardRequest {}

export class GetInventoryDashboardUseCase extends TransactionalUseCase<
  GetInventoryDashboardRequest,
  InventoryDashboardDTO
> {
  constructor(
    private readonly inventoryRepository: InventoryReadRepository,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: GetInventoryDashboardRequest,
    tx: Prisma.TransactionClient,
  ): Promise<InventoryDashboardDTO> {
    let data = await this.inventoryRepository.getDashboard();
    return data;
  }
}
