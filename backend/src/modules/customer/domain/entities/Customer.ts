import { v4 as uuid } from "uuid";

// src/modules/customer/domain/entities/Customer.ts
export class Customer {
  private _id: string;
  private _name: string;
  private _email: string | null;
  private _phone: string | null;
  private _address: string | null;
  private _createdAt: Date;

  constructor(props: {
    id?: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    createdAt?: Date;
  }) {
    this._id = props.id ?? uuid();
    this._name = props.name;
    this._email = props.email ?? null;
    this._phone = props.phone ?? null;
    this._address = props.address ?? null;
    this._createdAt = props.createdAt ?? new Date();
  }

  get id(): string {
    return this._id;
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

  get createdAt(): Date {
    return this._createdAt;
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
