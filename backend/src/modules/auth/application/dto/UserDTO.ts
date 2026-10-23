import { UserRole } from "@auth/domain/enums/UserRole";

/** Representação pública do usuário (nunca inclui a senha). */
export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
}

export interface IAuthRequestInput {
  email: string;
  password: string;
  /** IP de origem (chave do limitador de tentativas). */
  ip: string;
}

export interface IAuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface IAuthResult {
  token: string;
  user: IAuthUser;
}

export interface ICreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface IListUsersInput {
  page: number;
  limit: number;
  /** Busca por nome ou e-mail (sem diferenciar maiúsculas). */
  search?: string;
}

export interface IUpdateUserInput {
  /** Usuário autenticado que faz a alteração. */
  actorId: string;
  id: string;
  name?: string;
  role?: UserRole;
  active?: boolean;
}

export interface IResetUserPasswordInput {
  id: string;
  password: string;
}

export interface IChangeOwnPasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}
