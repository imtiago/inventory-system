// /src/modules/customer/domain/entities/Customer.ts
export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: Date;
}
