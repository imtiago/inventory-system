import { SupplierDTO } from "@purchases/application/dto/SupplierDTO";

/** Contrato HTTP do fornecedor: { id, name, document, documentType, email, phone, createdAt }. */
export class SupplierHttpPresenter {
  static toHTTP(supplier: SupplierDTO): SupplierDTO {
    return {
      id: supplier.id,
      name: supplier.name,
      document: supplier.document,
      documentType: supplier.documentType,
      email: supplier.email,
      phone: supplier.phone,
      createdAt: supplier.createdAt,
    };
  }
}
