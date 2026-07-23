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
