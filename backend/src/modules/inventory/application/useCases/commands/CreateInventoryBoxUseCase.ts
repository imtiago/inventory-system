import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { IInventoryBoxRepository } from "@inventory/domain/repositories/InventoryBoxRepository";
import { InventoryBox } from "@inventory/domain/entities/InventoryBox";
import { NumberGenerator } from "@shared/application/services/NumberGenerator";
import { NumberRangeName } from "@shared/domain/enums/NumberRangeName";
import { ICreateInventoryBoxInput } from "@inventory/application/dto/InventoryBoxDTO";

export class CreateInventoryBoxUseCase extends TransactionalUseCase<
  ICreateInventoryBoxInput,
  InventoryBox
> {
  constructor(
    private readonly inventoryBoxRepository: IInventoryBoxRepository,
    private numberGenerator: NumberGenerator,
    transactionManager: TransactionManager,
  ) {
    super(transactionManager);
  }

  async handle(
    request: ICreateInventoryBoxInput,
    tx: Prisma.TransactionClient,
  ): Promise<InventoryBox> {
    const boxCode = await this.numberGenerator.generate(
      NumberRangeName.INVENTORY_BOX,
      "B",
    );

    const lot = new InventoryBox({
      code: boxCode,
    });

    return await this.inventoryBoxRepository.create(lot);
  }
}
