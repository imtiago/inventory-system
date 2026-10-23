import { PaginatedResult } from "@shared/application/dtos/PaginatedResult";
import { UserDTO } from "../dto/UserDTO";
import { IListUsersInput } from "../dto/UserDTO";

export interface UserReadRepository {
  list(params: IListUsersInput): Promise<PaginatedResult<UserDTO>>;
  findById(id: string): Promise<UserDTO | null>;
}
