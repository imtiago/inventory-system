import { TransactionManager } from "@shared/domain/TransactionManager";
import { TransactionalUseCase } from "@shared/application/useCases/TransactionalUseCase";
import { Prisma } from "@prisma/client";
import { IInventoryBoxRepository } from "@inventory/domain/repositories/InventoryBoxRepository";
import { InventoryBox } from "@inventory/domain/entities/InventoryBox";
import { NumberGenerator } from "@shared/application/services/NumberGenerator";
import { NumberRangeName } from "@shared/domain/enums/NumberRangeName";
import {
  ICreateInventoryBoxInput,
  IInventoryBoxOutput,
} from "@inventory/application/dto/InventoryBoxDTO";

export class CreateInventoryBoxUseCase extends TransactionalUseCase<
  ICreateInventoryBoxInput,
  IInventoryBoxOutput
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
  ): Promise<IInventoryBoxOutput> {
    const boxCode = await this.numberGenerator.generate(
      NumberRangeName.INVENTORY_BOX,
      "B",
    );

    const lot = new InventoryBox({
      code: boxCode,
    });

    const data = await this.inventoryBoxRepository.create(lot);
    return {
      id: data.id,
      code: data.code,
    };
  }
}
