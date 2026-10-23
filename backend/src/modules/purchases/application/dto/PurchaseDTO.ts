import { FinancialDocumentSummaryDTO } from "@finance/application/dto/FinancialDocumentSummaryDTO";

export interface PurchaseItemDTO {
  id: string;
  productVariant: { id: string; name: string; code: string; barcode: string | null };
  quantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  discount: number;
  freight: number;
  tax: number;
  total: number;
  unitCost: number;
}

export interface PurchaseDTO {
  id: string;
  code: string;
  status: string;
  supplier: { id: string; name: string };
  /** "YYYY-MM-DD". */
  purchaseDate: string;
  notes: string | null;
  totalAmount: number;
  createdAt: Date;
  items: PurchaseItemDTO[];
  payable: FinancialDocumentSummaryDTO | null;
}

export interface PurchaseListItemDTO {
  id: string;
  code: string;
  status: string;
  supplier: { id: string; name: string };
  purchaseDate: string;
  totalAmount: number;
  itemsCount: number;
  /** floor(Σ recebido / Σ quantidade × 100). */
  receivedPercent: number;
  createdAt: Date;
}

export interface ICreatePurchaseInput {
  supplierId: string;
  /** "YYYY-MM-DD"; ausente = hoje (data de negócio). */
  purchaseDate?: string;
  notes: string | null;
  items: {
    productVariantId: string;
    quantity: number;
    unitPriceCents: number;
    discountCents: number;
    freightCents: number;
    taxCents: number;
  }[];
  paymentTerms: {
    installments: number;
    /** "YYYY-MM-DD"; obrigatório se installments > 1; padrão = purchaseDate. */
    firstDueDate?: string;
  };
}

export interface ICancelPurchaseInput {
  id: string;
  reason: string;
  /** Usuário autenticado que cancela. */
  userId: string;
}
