import { PayableParcel } from "./PayableParcel";

export interface Payable {
  id: string;
  purchaseId: string; // referência à compra
  totalAmount: number;
  createdAt: Date;
  parcels: PayableParcel[];
}
