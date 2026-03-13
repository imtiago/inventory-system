// src/modules/payables/application/useCases/MarkParcelPaid.ts

import { PayableParcel } from "@payables/domain/entities/PayableParcel";
import { PayableRepository } from "@payables/domain/repositories/PayableRepository";

export class MarkParcelPaid {
  constructor(private repo: PayableRepository) {}
  async execute(parcelId: string, paidAt: Date): Promise<PayableParcel> {
    return this.repo.markParcelAsPaid(parcelId, paidAt);
  }
}
