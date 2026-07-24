// application/queries/ProductQuery.ts

import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { UserDTO } from "../dto/UserDTO";
import { PaginationRequest } from "@shared/application/dtos/PaginationRequest";

export interface UserReadRepository {
  list(pagination: PaginationRequest): Promise<PaginatedResult<UserDTO[]>>;
}
