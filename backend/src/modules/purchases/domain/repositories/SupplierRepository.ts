import { Supplier } from "../entities/Supplier";

export interface SupplierRepository {
  create(variant: Supplier): Promise<Supplier>;
  update(variant: Supplier): Promise<Supplier>;

  findById(id: string): Promise<Supplier | null>;
  findByProduct(productId: string): Promise<Supplier[]>;

  findByBarcode(barcode: string): Promise<Supplier | null>;
  findByCode(code: string): Promise<Supplier | null>;

  delete(id: string): Promise<void>;
}
