import { v4 as uuid } from "uuid";
import { PayableParcel } from "./PayableParcel";

// src/modules/finance/domain/entities/Payable.ts
export class Payable {
  id: string;
  purchaseId: string;
  totalAmount: number;
  createdAt: Date;
  parcels: PayableParcel[];

  constructor(props: {
    id?: string;
    purchaseId: string;
    totalAmount?: number;
    createdAt?: Date;
    parcels?: PayableParcel[];
  }) {
    this.id = props.id ?? uuid();
    this.purchaseId = props.purchaseId;
    this.totalAmount = props.totalAmount ?? 0;
    this.createdAt = props.createdAt ?? new Date();
    this.parcels = props.parcels ?? [];
  }
}
