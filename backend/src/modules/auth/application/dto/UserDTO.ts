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
  code: string;
  email?: string;
  role: UserRole;
}
