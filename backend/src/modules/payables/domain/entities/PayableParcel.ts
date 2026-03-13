export interface PayableParcel {
  id: string;
  payableId: string;
  amount: number;
  dueDate: Date;
  paid: boolean;
  paidAt?: Date;
}
