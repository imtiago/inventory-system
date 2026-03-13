import { User } from "../entities/User";

export interface UserRepository {
  create(user: User): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  list(page: number, limit: number): Promise<User[]>;
}
