import { v4 as uuid } from "uuid";
import { UserRole } from "../enums/UserRole";

// src/modules/auth/domain/entities/User.ts
export class User {
  private _id: string;
  private _name: string;
  private _email: string;
  private _password: string;
  private _role: UserRole;
  private _createdAt: Date;

  constructor(props: {
    id?: string;
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    createdAt?: Date;
  }) {
    this._id = props.id ?? uuid();
    this._name = props.name;
    this._email = props.email;
    this._password = props.password;
    this._role = props.role ?? UserRole.VENDEDOR;
    this._createdAt = props.createdAt ?? new Date();
  }

  get id(): string {
    return this._id;
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

  get createdAt(): Date {
    return this._createdAt;
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
