import { Prisma } from "@prisma/client";
import { InventoryBox } from "../entities/InventoryBox";
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
export interface IInventoryBoxRepository extends ICrudRepository<InventoryBox> {
  findByCode(
    code: string,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryBox | null>;
  // findById(
  //   id: string,
  //   tx?: Prisma.TransactionClient,
  // ): Promise<InventoryBox | null>;

  // save(box: InventoryBox, tx?: Prisma.TransactionClient): Promise<InventoryBox>;
}
