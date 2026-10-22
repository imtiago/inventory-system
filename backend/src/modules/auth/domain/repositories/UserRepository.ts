import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
import { User } from "../entities/User";

export interface UserRepository extends ICrudRepository<User> {
  findByEmail(email: string): Promise<User | null>;
  // list(page: number, limit: number): Promise<User[]>;
}
