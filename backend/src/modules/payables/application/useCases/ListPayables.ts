// src/modules/payables/application/useCases/ListPayables.ts

import { Payable } from "@payables/domain/entities/Payable";
import { PayableRepository } from "@payables/domain/repositories/PayableRepository";

export class ListPayables {
  constructor(private repo: PayableRepository) {}
  async execute(): Promise<Payable[]> {
    return this.repo.list();
  }
}
