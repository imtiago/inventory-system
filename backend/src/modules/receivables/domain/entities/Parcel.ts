export interface Parcel {
  id: string;
  receivableId: string;
  amount: number;
  dueDate: Date;
  paid: boolean;
  paidAt?: Date;
}
