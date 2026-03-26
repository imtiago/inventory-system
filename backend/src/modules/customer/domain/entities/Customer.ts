import { v4 as uuid } from "uuid";

// /src/modules/customer/domain/entities/Customer.ts
export class Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: Date;

  constructor(props: {
    id?: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    createdAt?: Date;
  }) {
    this.id = props.id ?? uuid();
    this.name = props.name;
    this.email = props.email ?? null;
    this.phone = props.phone ?? null;
    this.address = props.address ?? null;
    this.createdAt = props.createdAt ?? new Date();
  }
}
