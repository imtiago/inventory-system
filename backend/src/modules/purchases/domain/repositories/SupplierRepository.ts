import { Supplier } from "../entities/Supplier";

export interface SupplierPatchData {
  name?: string;
  document?: string;
  email?: string | null;
  phone?: string | null;
}

export interface SupplierRepository {
  findById(id: string): Promise<Supplier | null>;
  findByDocument(document: string): Promise<Supplier | null>;
  create(supplier: Supplier): Promise<Supplier>;
  /** Grava só as chaves presentes em `patch` (undefined = não toca; null = limpa). */
  update(id: string, patch: SupplierPatchData): Promise<Supplier>;
  /** Trava a linha (FOR UPDATE); exige transação ativa. false se não existe. */
  lockById(id: string): Promise<boolean>;
  countPurchases(id: string): Promise<number>;
  delete(id: string): Promise<void>;
}
