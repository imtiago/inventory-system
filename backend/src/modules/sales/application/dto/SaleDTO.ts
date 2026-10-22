import { SaleItemDTO } from "./SaleItemDTO";

export interface SaleDTO {
  id: string;

  customer: {
    id: string;
    name: string;
  };

  items: SaleItemDTO[];

  totalAmount: number;

  status: string;

  createdAt: Date;
}

export interface ICancelSaleInput {
  id: string;
}

export interface ICreateSaleInput {
  customerId: string;

  items: {
    productVariantId: string;
    quantity: number;
    price: number;
  }[];

  installments?: {
    amount: number;
    dueDate: Date;
  }[];
}

export interface ISaleOutput {
  id: string;

  customer_id: string;

  items: SaleItemDTO[];

  totalAmount: number;

  status: string;
}
