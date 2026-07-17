// src/modules/payables/domain/repositories/PayableRepository.ts
import { Payable } from "../entities/Payable";
import { PayableParcel } from "../entities/PayableParcel";

export interface PayableRepository {
  create(payable: Payable): Promise<Payable>;
  list(): Promise<Payable[]>;
  findById(id: string): Promise<Payable | null>;
  markParcelAsPaid(parcelId: string, paidAt: Date): Promise<PayableParcel>;
}
