import { UserRole } from "../enums/UserRole";
import { BaseEntity } from "@shared/domain/entities/BaseEntity";

// src/modules/auth/domain/entities/User.ts
export class User extends BaseEntity {
  private _name: string;
  private _email: string;
  private _password: string;
  private _role: UserRole;

  constructor(props: {
    id?: string;
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    createdAt?: Date;
  }) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });
    
    this._name = props.name;
    this._email = props.email;
    this._password = props.password;
    this._role = props.role ?? UserRole.VENDEDOR;
  }

  get name(): string {
    return this._name;
  }

  get email(): string {
    return this._email;
  }

  get password(): string {
    return this._password;
  }

  get role(): UserRole {
    return this._role;
  }

  rename(name: string): void {
    this._name = name;
  }

  changeEmail(email: string): void {
    this._email = email;
  }

  changePassword(hashedPassword: string): void {
    this._password = hashedPassword;
  }

  changeRole(role: UserRole): void {
    this._role = role;
  }
}
