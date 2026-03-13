// src/modules/receivables/application/useCases/ListReceivables.ts

import { Receivable } from "@receivables/domain/entities/Receivable";
import { ReceivableRepository } from "@receivables/domain/repositories/ReceivableRepository";

export class ListReceivables {
  constructor(private repo: ReceivableRepository) {}

  async execute(): Promise<Receivable[]> {
    return this.repo.list();
  }
}
