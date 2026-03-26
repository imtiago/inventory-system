import { v4 as uuid } from "uuid";

// src/modules/finance/domain/entities/Parcel.ts
export class Parcel {
  id: string;
  receivableId: string | null;
  amount: number;
  dueDate: Date;
  paid: boolean;
  paidAt: Date | null;

  constructor(props: {
    id?: string;
    receivableId?: string | null;
    amount?: number;
    dueDate: Date;
    paid?: boolean;
    paidAt?: Date | null;
  }) {
    this.id = props.id ?? uuid();
    this.receivableId = props.receivableId ?? null;
    this.amount = props.amount ?? 0;
    this.dueDate = props.dueDate;
    this.paid = props.paid ?? false;
    this.paidAt = props.paidAt ?? null;
  }

  markAsPaid(date?: Date) {
    this.paid = true;
    this.paidAt = date ?? new Date();
  }
}
