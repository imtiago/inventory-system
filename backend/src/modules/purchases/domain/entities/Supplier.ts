import { BaseEntity } from "@shared/domain/entities/BaseEntity";

/** Fornecedor: `document` normalizado (CPF 11 dígitos ou CNPJ 14 posições, possivelmente alfanumérico); o tipo é derivado. */
export class Supplier extends BaseEntity {
  private _name: string;
  private _document: string;
  private _email: string | null;
  private _phone: string | null;

  constructor(props: {
    id?: string;
    name: string;
    document: string;
    email?: string | null;
    phone?: string | null;
    createdAt?: Date;
  }) {
    super({ id: props.id, createdAt: props.createdAt });
    this._name = props.name;
    this._document = props.document;
    this._email = props.email ?? null;
    this._phone = props.phone ?? null;
  }

  get name(): string {
    return this._name;
  }
  get document(): string {
    return this._document;
  }
  get email(): string | null {
    return this._email;
  }
  get phone(): string | null {
    return this._phone;
  }
}
