// src/modules/receivables/domain/repositories/ReceivableRepository.ts

import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
import { Parcel } from "../entities/Parcel";
import { Receivable } from "../entities/Receivable";

export interface ReceivableRepository extends ICrudRepository<Receivable> {
  // list(): Promise<Receivable[]>;
  markParcelAsPaid(parcelId: string, paidAt: Date): Promise<Parcel>;
}
