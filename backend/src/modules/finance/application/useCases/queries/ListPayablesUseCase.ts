import { PaginationParams } from "@shared/application/pagination";
import { Payable } from "modules/finance/domain/entities/Payable";
import { PayableRepository } from "modules/finance/domain/repositories/PayableRepository";

export class ListPayablesUseCase {
  constructor(private repo: PayableRepository) {}
  async execute({ page, limit }: PaginationParams): Promise<Payable[]> {
    return this.repo.list();
  }
}
