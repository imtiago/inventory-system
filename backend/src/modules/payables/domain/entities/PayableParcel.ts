import { v4 as uuid } from "uuid";

// src/modules/finance/domain/entities/PayableParcel.ts
export class PayableParcel {
  id: string;
  payableId: string;
  amount: number;
  dueDate: Date;
  paid: boolean;
  paidAt: Date | null;

  constructor(props: {
    id?: string;
    payableId: string;
    amount?: number;
    dueDate: Date;
    paid?: boolean;
    paidAt?: Date | null;
  }) {
    this.id = props.id ?? uuid();
    this.payableId = props.payableId;
    this.amount = props.amount ?? 0;
    this.dueDate = props.dueDate;
    this.paid = props.paid ?? false;
    this.paidAt = props.paidAt ?? null;
  }
}
