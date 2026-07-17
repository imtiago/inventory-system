// src/modules/payables/application/useCases/MarkParcelPaid.ts

import { PayableParcel } from "modules/finance/domain/entities/PayableParcel";
import { PayableRepository } from "modules/finance/domain/repositories/PayableRepository";

export class MarkParcelPaid {
  constructor(private repo: PayableRepository) {}
  async execute(parcelId: string, paidAt: Date): Promise<PayableParcel> {
    return this.repo.markParcelAsPaid(parcelId, paidAt);
  }
}
