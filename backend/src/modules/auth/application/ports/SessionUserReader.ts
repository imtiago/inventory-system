import { UserRole } from "@auth/domain/enums/UserRole";

export interface SessionUser {
  id: string;
  role: UserRole;
  active: boolean;
}

/** Leitura mínima do usuário para validar a sessão a cada requisição. */
export interface SessionUserReader {
  findById(id: string): Promise<SessionUser | null>;
}
