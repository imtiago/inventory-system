import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { NfeDocument } from "@nfe-import/domain/NfeDocument";
import { NfeImportStatus } from "@nfe-import/domain/NfeImportStatus";
import { NfeImportSummaryDTO } from "../dto/NfeImportDTO";

export interface NfeImportRecord {
  id: string;
  accessKey: string;
  status: NfeImportStatus;
  purchaseId: string | null;
  createdAt: Date;
  document: NfeDocument;
}

export interface NfeImportListFilters {
  status?: NfeImportStatus;
}

export interface NfeImportReadRepository {
  list(pagination: PaginationRequest, filters?: NfeImportListFilters): Promise<PaginatedResult<NfeImportSummaryDTO>>;
  getById(id: string): Promise<NfeImportRecord | null>;
}
