import { PaymentDTO } from "./PaymentDTO";

export interface FinancialParcelDTO {
  id: string;

  amount: number;

  paidAmount: number;

  remainingAmount: number;

  dueDate: Date;

  status: string;

  payments: PaymentDTO[];
}
