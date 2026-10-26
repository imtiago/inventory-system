import { BaseEntity } from "@shared/domain/entities/BaseEntity";

// src/modules/customer/domain/entities/Customer.ts
export class Customer extends BaseEntity {
  private _name: string;
  private _code: string;
  private _email: string | null;
  private _phone: string | null;
  private _address: string | null;
  private _document: string | null;

  constructor(props: {
    id?: string;
    name: string;
    code: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    document?: string | null;
    createdAt?: Date;
  }) {
    super({
      id: props.id,
      createdAt: props.createdAt,
    });
    this._name = props.name;
    this._code = props.code;
    this._email = props.email ?? null;
    this._phone = props.phone ?? null;
    this._address = props.address ?? null;
    this._document = props.document ?? null;
  }

  get name(): string {
    return this._name;
  }
  get code(): string {
    return this._code;
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

  get document(): string | null {
    return this._document;
  }
}
