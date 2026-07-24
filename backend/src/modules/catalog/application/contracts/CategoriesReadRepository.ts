import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { CategoriesListDTO } from "../dto/CategoriesListDTO";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";

export interface CategoriesReadRepository {
  list(
    pagination: PaginationRequest,
  ): Promise<PaginatedResult<CategoriesListDTO>>;

  getById(id: string): Promise<CategoriesListDTO | null>;
}
