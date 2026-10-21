// domain/entities/Supplier.ts

export interface SupplierProps {
  id?: string;

  name: string;

  document: string;

  email?: string;

  phone?: string;

  createdAt?: Date;

  updatedAt?: Date;
}

export class Supplier {
  public readonly id?: string;

  private name: string;

  private document: string;

  private email?: string;

  private phone?: string;

  public readonly createdAt: Date;

  public updatedAt: Date;

  constructor(props: SupplierProps) {
    this.id = props.id;

    this.name = props.name;

    this.document = props.document;

    this.email = props.email;

    this.phone = props.phone;

    this.createdAt = props.createdAt ?? new Date();

    this.updatedAt = props.updatedAt ?? new Date();
  }

  public getName(): string {
    return this.name;
  }

  public getDocument(): string {
    return this.document;
  }

  public changeName(name: string): void {
    this.name = name;
    this.updatedAt = new Date();
  }

  public changeEmail(email: string): void {
    this.email = email;
    this.updatedAt = new Date();
  }

  public changePhone(phone: string): void {
    this.phone = phone;
    this.updatedAt = new Date();
  }
}
