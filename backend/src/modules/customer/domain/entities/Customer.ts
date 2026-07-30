import { BaseEntity } from "@shared/domain/entities/BaseEntity";

// src/modules/customer/domain/entities/Customer.ts
export class Customer extends BaseEntity {
  private _name: string;
  private _email: string | null;
  private _phone: string | null;
  private _address: string | null;

  constructor(props: {
    id?: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    createdAt?: Date;
  }) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });
    this._name = props.name;
    this._email = props.email ?? null;
    this._phone = props.phone ?? null;
    this._address = props.address ?? null;
  }

  get name(): string {
    return this._name;
  }

  get email(): string | null {
    return this._email;
  }

  get phone(): string | null {
    return this._phone;
  }

  get address(): string | null {
    return this._address;
  }

  rename(name: string): void {
    this._name = name;
  }

  changeEmail(email: string | null): void {
    this._email = email;
  }

  changePhone(phone: string | null): void {
    this._phone = phone;
  }

  changeAddress(address: string | null): void {
    this._address = address;
  }
}
