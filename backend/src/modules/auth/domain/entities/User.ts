import { UserRole } from "../enums/UserRole";
import { BaseEntity } from "@shared/domain/entities/BaseEntity";

export class User extends BaseEntity {
  private _name: string;
  private _email: string;
  private _password: string;
  private _role: UserRole;
  private _active: boolean;

  constructor(props: {
    id?: string;
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    active?: boolean;
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
    this._active = props.active ?? true;
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

  get active(): boolean {
    return this._active;
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

  activate(): void {
    this._active = true;
  }

  deactivate(): void {
    this._active = false;
  }
}
