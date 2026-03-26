import { v4 as uuid } from "uuid";
import { Parcel } from "./Parcel";

// src/modules/finance/domain/entities/Receivable.ts
export class Receivable {
  id: string;
  saleId: string;
  totalAmount: number;
  createdAt: Date;
  parcels: Parcel[];

  constructor(props: {
    id?: string;
    saleId: string;
    totalAmount?: number;
    createdAt?: Date;
    parcels?: Parcel[];
  }) {
    this.id = props.id ?? uuid();
    this.saleId = props.saleId;
    this.totalAmount = props.totalAmount ?? 0;
    this.createdAt = props.createdAt ?? new Date();
    this.parcels = props.parcels ?? [];
  }

  addParcel(parcel: Parcel) {
    this.parcels.push(parcel);
  }

  get calculatedTotal(): number {
    return this.parcels.reduce((sum, p) => sum + p.amount, 0);
  }

  validateTotal() {
    if (this.calculatedTotal !== this.totalAmount) {
      throw new Error("Total inconsistente com as parcelas");
    }
  }
}
