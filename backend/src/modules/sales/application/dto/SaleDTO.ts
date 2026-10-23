import { SaleItemDTO } from "./SaleItemDTO";

export interface SaleReceivableParcelDTO {
  id: string;
  amount: number;
  /** Data sem hora, "YYYY-MM-DD" (UTC). */
  dueDate: string;
  paidAmount: number;
  remainingAmount: number;
  status: string;
}

export interface SaleReceivableDTO {
  id: string;
  status: string;
  parcels: SaleReceivableParcelDTO[];
}

export interface SaleDetailDTO {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: Date;
  customer: { id: string; name: string };
  seller: { id: string; name: string } | null;
  items: SaleItemDTO[];
  receivable: SaleReceivableDTO | null;
}

export interface SaleListItemDTO {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: Date;
  customer: { id: string; name: string };
  itemsCount: number;
}

export interface ICancelSaleInput {
  id: string;
}

export interface ICreateSaleInput {
  customerId: string;
  /** Usuário autenticado (request.user.sub). */
  sellerId: string;
  items: {
    productVariantId: string;
    quantity: number;
  }[];
  paymentTerms: {
    installments: number;
    /** Meia-noite UTC; ausente com 1 parcela = hoje. */
    firstDueDate?: Date;
  };
}
