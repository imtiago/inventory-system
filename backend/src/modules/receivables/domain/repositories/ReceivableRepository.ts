// src/modules/receivables/domain/repositories/ReceivableRepository.ts

import { Parcel } from "../entities/Parcel";
import { Receivable } from "../entities/Receivable";

export interface ReceivableRepository {
  create(data: Receivable, tx?: any): Promise<Receivable>;
  list(): Promise<Receivable[]>;
  findById(id: string): Promise<Receivable | null>;
  markParcelAsPaid(parcelId: string, paidAt: Date): Promise<Parcel>;
}
