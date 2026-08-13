import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { InventoryBoxRepository } from "@inventory/domain/repositories/InventoryBoxRepository";
import { InventoryBox } from "@inventory/domain/entities/InventoryBox";
import { NumberGenerator } from "@shared/application/services/NumberGenerator";
import { NumberRangeName } from "@shared/domain/enums/NumberRangeName";

export interface CreateInventoryBoxInput {}

export class CreateInventoryBoxUseCase extends TransactionalUseCase<
  CreateInventoryBoxInput,
  InventoryBox
> {
  constructor(
    private readonly inventoryBoxRepository: InventoryBoxRepository,
    private numberGenerator: NumberGenerator,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: CreateInventoryBoxInput,
    tx: Prisma.TransactionClient,
  ): Promise<InventoryBox> {
    const boxCode = await this.numberGenerator.generate(
      NumberRangeName.INVENTORY_BOX,
      "B",
    );

    const lot = new InventoryBox({
      code: boxCode,
    });

    return await this.inventoryBoxRepository.save(lot, tx);
  }
}
