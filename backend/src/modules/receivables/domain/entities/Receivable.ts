import { Parcel } from "./Parcel";

export interface Receivable {
  id: string;
  saleId: string;
  totalAmount: number;
  createdAt: Date;
  parcels: Parcel[];
}
