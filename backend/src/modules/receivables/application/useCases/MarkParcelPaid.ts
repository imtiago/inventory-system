// src/modules/receivables/application/useCases/MarkParcelPaid.ts

import { Parcel } from "@receivables/domain/entities/Parcel";
import { ReceivableRepository } from "@receivables/domain/repositories/ReceivableRepository";

export class MarkParcelPaid {
  constructor(private repo: ReceivableRepository) {}

  async execute(parcelId: string, paidAt: Date): Promise<Parcel> {
    return this.repo.markParcelAsPaid(parcelId, paidAt);
  }
}
