import { UserRole } from "@auth/domain/enums/UserRole";

export interface UserDTO {
  id: string;

  name: string;

  email: string;

  role: UserRole;

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

export interface IUserOutput {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
}
