import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { NfeImportStatus } from "@nfe-import/domain/NfeImportStatus";
import { NfeImportReadRepository } from "../../contracts/NfeImportReadRepository";
import { NfeImportSummaryDTO } from "../../dto/NfeImportDTO";

interface ListNfeImportsParams {
  page: number;
  limit: number;
  status?: NfeImportStatus;
}

export class ListNfeImportsUseCase {
  constructor(private readRepo: NfeImportReadRepository) {}

  async execute({ page, limit, status }: ListNfeImportsParams): Promise<PaginatedResult<NfeImportSummaryDTO>> {
    return this.readRepo.list({ page, limit }, { status });
  }
}
