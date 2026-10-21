export interface ICreatePayableInput {
  purchaseId: string;
  totalAmount: number;
  parcels: { amount: number; dueDate: Date }[];
}
