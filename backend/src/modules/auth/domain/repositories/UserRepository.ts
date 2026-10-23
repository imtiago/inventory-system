import { ICrudRepository } from "@shared/domain/repositories/CrudRepository";
import { User } from "../entities/User";
import { UserRole } from "../enums/UserRole";

/** Campos de cadastro/acesso alteráveis pelo admin (gravação só do que mudou). */
export type UserAccessChanges = {
  name?: string;
  role?: UserRole;
  active?: boolean;
};

export interface UserRepository extends ICrudRepository<User> {
  findByEmail(email: string): Promise<User | null>;
  /**
   * Lê o usuário travando a linha (`FOR UPDATE`) até o fim da transação atual.
   * Fora de transação, equivale a `findById`.
   */
  findByIdForUpdate(id: string): Promise<User | null>;
  /** Grava apenas os campos informados (não reescreve senha nem os demais). */
  updateAccess(id: string, changes: UserAccessChanges): Promise<User>;
  /** Grava apenas o hash da senha (não reescreve papel/ativo). */
  updatePassword(id: string, passwordHash: string): Promise<void>;
  /**
   * Conta os ADMIN ativos diferentes de `id`. Dentro de uma transação, a
   * implementação deve bloquear as linhas dos admins ativos (em ordem de id)
   * até o fim dela, para que duas alterações concorrentes não removam juntas
   * os últimos admins.
   */
  countActiveAdminsExcluding(id: string): Promise<number>;
}
