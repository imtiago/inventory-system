// src/modules/payables/domain/repositories/PayableRepository.ts
import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
import { Payable } from "../entities/Payable";
import { PayableParcel } from "../entities/PayableParcel";

export interface PayableRepository extends ICrudRepository<Payable> {
  // list(): Promise<Payable[]>;
  markParcelAsPaid(parcelId: string, paidAt: Date): Promise<PayableParcel>;
}
