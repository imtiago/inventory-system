import { Customer } from "../entities/Customer";

export interface CustomerPatchData {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface CustomerRepository {
  findById(id: string): Promise<Customer | null>;
  create(customer: Customer): Promise<Customer>;
  /** Grava só as chaves presentes em `patch` (undefined = não toca; null = limpa). */
  update(id: string, patch: CustomerPatchData): Promise<Customer>;
}
