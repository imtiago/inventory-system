import { Prisma } from "@prisma/client";
import { InventoryBox } from "../entities/InventoryBox";
export interface InventoryBoxRepository {
  findByCode(
    code: string,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryBox | null>;
  findById(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryBox | null>;

  save(box: InventoryBox, tx?: Prisma.TransactionClient): Promise<InventoryBox>;
}
