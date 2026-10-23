import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";
import { CategoryDTO } from "../dto/CategoryDTO";
import { NameSearchFilters } from "./NameSearchFilters";

export interface CategoryReadRepository {
  /** Ordenado por nome sem diferença de caixa. */
  list(pagination: PaginationRequest, filters?: NameSearchFilters): Promise<PaginatedResult<CategoryDTO>>;

  getById(id: string): Promise<CategoryDTO | null>;
}
