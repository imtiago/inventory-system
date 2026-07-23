// application/queries/ProductQuery.ts

import { UserDTO } from "../dto/UserDTO";

export interface UserReadRepository {
  list(): Promise<UserDTO[]>;
}
