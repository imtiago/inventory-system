// src/modules/payables/application/useCases/ListPayables.ts

import { Payable } from "modules/finance/domain/entities/Payable";
import { PayableRepository } from "modules/finance/domain/repositories/PayableRepository";

export class ListPayables {
  constructor(private repo: PayableRepository) {}
  async execute(): Promise<Payable[]> {
    return this.repo.list();
  }
}
