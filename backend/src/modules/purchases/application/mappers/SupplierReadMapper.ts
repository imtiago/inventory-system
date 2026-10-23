import { documentTypeOf } from "@shared/domain/document";
import { SupplierDTO } from "../dto/SupplierDTO";

type SupplierLike = {
  id: string;
  name: string;
  document: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
};

export class SupplierReadMapper {
  static toDTO(data: SupplierLike): SupplierDTO {
    return {
      id: data.id,
      name: data.name,
      document: data.document,
      // Documentos gravados passaram pela validação; o fallback cobre só dados legados.
      documentType: documentTypeOf(data.document) ?? (data.document.length > 11 ? "CNPJ" : "CPF"),
      email: data.email,
      phone: data.phone,
      createdAt: data.createdAt,
    };
  }
}
