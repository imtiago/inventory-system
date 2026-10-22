import { InventoryBox } from "../entities/InventoryBox";
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
export interface IInventoryBoxRepository extends ICrudRepository<InventoryBox> {
  findByCode(
    code: string
  ): Promise<InventoryBox | null>;
  // findById(
  //   id: string,
  // ): Promise<InventoryBox | null>;

  // save(box: InventoryBox): Promise<InventoryBox>;
}
