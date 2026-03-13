// src/modules/receivables/domain/repositories/ReceivableRepository.ts

import { Parcel } from "../entities/Parcel";
import { Receivable } from "../entities/Receivable";

export interface ReceivableRepository {
  create(receivable: Receivable): Promise<Receivable>;
  list(): Promise<Receivable[]>;
  getById(id: string): Promise<Receivable | null>;
  markParcelAsPaid(parcelId: string, paidAt: Date): Promise<Parcel>;
}
