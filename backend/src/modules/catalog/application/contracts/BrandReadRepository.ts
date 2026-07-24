import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { BrandListDTO } from "../dto/BrandListDTO";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";

export interface BrandReadRepository {
  list(pagination: PaginationRequest): Promise<PaginatedResult<BrandListDTO>>;

  getById(id: string): Promise<BrandListDTO | null>;
}
