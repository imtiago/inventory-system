import { SaleItem } from "./SaleItem";

export interface Sale {
  id: string;
  customerId: string;
  items: SaleItem[];
  totalAmount: number;
  createdAt: Date;
}
