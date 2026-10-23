import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { BrandDTO } from "../dto/BrandDTO";
import { NameSearchFilters } from "./NameSearchFilters";

export interface BrandReadRepository {
  /** Ordenado por nome sem diferença de caixa. */
  list(pagination: PaginationRequest, filters?: NameSearchFilters): Promise<PaginatedResult<BrandDTO>>;

  getById(id: string): Promise<BrandDTO | null>;
}
