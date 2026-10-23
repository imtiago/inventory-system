import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
import { User } from "../entities/User";

export interface UserRepository extends ICrudRepository<User> {
  findByEmail(email: string): Promise<User | null>;
  /**
   * Conta os ADMIN ativos diferentes de `id`. Dentro de uma transação, a
   * implementação deve bloquear as linhas dos admins ativos até o fim dela,
   * para que duas alterações concorrentes não removam juntas os últimos admins.
   */
  countActiveAdminsExcluding(id: string): Promise<number>;
}
